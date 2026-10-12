import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  createDecipheriv, createECDH, createHmac, createPublicKey,
  randomBytes, verify,
} from "node:crypto";

const src = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const vapid = createECDH("prime256v1");
vapid.generateKeys();
const vars = {
  CSS_ADMIN_PUSH_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"),
  CSS_ADMIN_PUSH_VAPID_PRIVATE_KEY: Buffer.concat([Buffer.alloc(32), vapid.getPrivateKey()]).subarray(-32).toString("base64url"),
  CSS_ADMIN_PUSH_SUBJECT: "mailto:push@example.test",
};

function harness() {
  const source = src("lib/staff-push-crypto.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const requests = [];
  vm.runInNewContext(output, {
    module, exports: module.exports,
    Buffer, URL, process: { env: { ...vars } }, AbortSignal,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { status: 201 };
    },
    require(name) {
      if (name === "node:crypto") return requireCrypto;
      throw new Error("Unexpected crypto dependency: " + name);
    },
  });
  return { crypto: module.exports, requests };
}
const requireCrypto = await import("node:crypto");

const client = createECDH("prime256v1");
client.generateKeys();
const auth = randomBytes(16);
const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/fixture",
  keys: {
    p256dh: client.getPublicKey().toString("base64url"),
    auth: auth.toString("base64url"),
  },
};

function hkdf(ikm, salt, info, length) {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, length);
}

test("subscription host allowlist rejects local, arbitrary and forged push endpoints", () => {
  const { crypto } = harness();
  assert.equal(crypto.validatedPushSubscription(sub).endpoint, sub.endpoint);
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/x",
    "https://127.0.0.1/admin",
    "https://fcm.googleapis.com.evil.test/fcm/send/x",
    "https://example.com/hook",
    "https://user:secret@web.push.apple.com/q",
    "https://web.push.apple.com:8443/q",
  ]) {
    assert.throws(() => crypto.validatedPushSubscription({ ...sub, endpoint }));
  }
  assert.throws(() => crypto.validatedPushSubscription({
    ...sub, keys: { ...sub.keys, auth: "not-base64?" },
  }));
});

test("AES-GCM seals endpoint and browser keys with device and Staff owner AAD", () => {
  const { crypto } = harness();
  const id = "a2222222-2222-4222-8222-222222222222";
  const sealed = crypto.sealPushSubscription(sub, 42, id);
  assert.ok(!sealed.includes("fcm.googleapis.com"));
  assert.deepEqual(
    JSON.parse(JSON.stringify(crypto.openPushSubscription(sealed, 42, id))), sub,
  );
  assert.throws(() => crypto.openPushSubscription(sealed, 43, id));
  assert.throws(() => crypto.openPushSubscription(sealed, 42, "other"));
});

test("VAPID signing credentials remain server-side and JWT validates ES256", async () => {
  const { crypto, requests } = harness();
  crypto.assertPushDispatcherConfiguration();
  assert.equal(crypto.verifiedVapidPublicKey(), vars.CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY);
  assert.equal(await crypto.sendExportReadyPush(sub), 201);
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(request.url, sub.endpoint);
  assert.equal(request.options.headers["Content-Encoding"], "aes128gcm");
  const authHeader = request.options.headers.Authorization;
  const match = /^vapid t=([^,]+), k=(.+)$/.exec(authHeader);
  assert.ok(match);
  assert.equal(match[2], vars.CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY);
  const [header, payload, sig] = match[1].split(".");
  assert.equal(JSON.parse(Buffer.from(header, "base64url")).alg, "ES256");
  assert.equal(JSON.parse(Buffer.from(payload, "base64url")).aud, "https://fcm.googleapis.com");
  const pub = Buffer.from(vars.CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY, "base64url");
  const key = createPublicKey({ key: {
    kty: "EC", crv: "P-256",
    x: pub.subarray(1, 33).toString("base64url"),
    y: pub.subarray(33).toString("base64url"),
  }, format: "jwk" });
  assert.equal(verify("sha256", Buffer.from(header + "." + payload),
    { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url")), true);
});

test("RFC8291 AES128GCM payload decrypts with the browser subscription secret", () => {
  const { crypto } = harness();
  const encrypted = Buffer.from(
    crypto.encryptWebPushPayload(sub, JSON.stringify({ event: "export_ready" })),
  );
  const salt = encrypted.subarray(0, 16);
  assert.equal(encrypted.readUInt32BE(16), 4096);
  const pubLen = encrypted[20];
  assert.equal(pubLen, 65);
  const serverPublic = encrypted.subarray(21, 21 + pubLen);
  const ciphertext = encrypted.subarray(21 + pubLen);
  const ecdhSecret = client.computeSecret(serverPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), client.getPublicKey(), serverPublic]);
  const ikm = hkdf(ecdhSecret, auth, info, 32);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const plain = Buffer.concat([
    decipher.update(ciphertext.subarray(0, -16)), decipher.final(),
  ]);
  assert.equal(plain.at(-1), 2);
  assert.deepEqual(JSON.parse(plain.subarray(0, -1).toString("utf8")),
    { event: "export_ready" });
});

test("post-commit outbox discovery binds only already-subscribed Staff owners", () => {
  const sql = src("deploy/postgres/004_staff_export_push.sql");
  const dispatcher = src("worker/staff-push-dispatcher.ts");
  assert.match(sql, /staff_push_delivery/);
  assert.match(sql, /staff_push_subscription/);
  assert.doesNotMatch(sql, /CREATE TRIGGER|ALTER TABLE css_admin\.export_job/);
  assert.match(dispatcher, /discoverReadyExports/);
  assert.match(dispatcher, /job.owner_admin_user_id/);
  assert.match(dispatcher, /job.finished_at >= subscription.updated_at/);
  assert.match(dispatcher, /ON CONFLICT DO NOTHING/);
  assert.match(dispatcher, /subscription.owner_admin_user_id = job.owner_admin_user_id/);
  assert.match(dispatcher, /subscription.owner_admin_user_id = export_job.owner_admin_user_id/);
  assert.match(dispatcher, /FOR UPDATE OF delivery SKIP LOCKED/);
  assert.match(dispatcher, /attempts < 5/);
  assert.match(dispatcher, /\[404, 410\]/);
  assert.match(dispatcher, /--preflight/);
  assert.doesNotMatch(dispatcher, /MAGENTO_ADMIN_TOKEN|MAGENTO.*PASSWORD|getAdminToken\(/);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE/);
});

test("subscription registration resolves Staff identity server-side and never trusts browser user_id", () => {
  const s = src("lib/staff-push.ts");
  const endpoint = src("app/api/admin/push/subscription/route.ts");
  const status = src("app/api/admin/push/status/route.ts");
  const session = src("lib/session.ts");
  assert.match(endpoint, /currentStaffJobIdentity\(\)/);
  assert.match(endpoint, /registerStaffPush\(actor.user_id, deviceId, input\)/);
  assert.match(endpoint, /sameOriginMutation\(request\)/);
  assert.match(endpoint, /staffPushCookieOptions\(\)/);
  assert.match(status, /currentStaffJobIdentity\(\)/);
  assert.match(s, /pg_advisory_xact_lock/);
  assert.match(s, /staff_push_subscription/);
  assert.match(s, /at most five devices/i);
  assert.match(s, /sealed_subscription/);
  assert.match(session, /await revokeCurrentPushDevice\(store\)/);
  assert.equal((session.match(/await revokeCurrentPushDevice\(store\)/g) ?? []).length, 3);
});

test("push permission stays user-triggered; service worker has no fetch or offline cache", () => {
  const component = src("components/staff-export-push-controls.tsx");
  const page = src("app/(admin)/jobs/page.tsx");
  const worker = src("public/sw.js");
  assert.match(component, /Notification.requestPermission\(\)/);
  assert.match(component, /pushManager.subscribe\(/);
  assert.match(component, /method: "DELETE"/);
  assert.match(page, /<StaffExportPushControls \/>/);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /addEventListener\("notificationclick"/);
  assert.match(worker, /export_ready/);
  assert.match(worker, /"\/jobs"/);
  assert.doesNotMatch(worker, /addEventListener\(["']fetch|caches\.|cache\.put|localStorage|indexedDB/);
  assert.doesNotMatch(worker, /email|grand_total|order_number/);
});

test("only the VAPID public key enters the web process", () => {
  const http = src("app/api/admin/push/status/route.ts");
  const control = src("components/staff-export-push-controls.tsx");
  const dispatcher = src("worker/staff-push-dispatcher.ts");
  assert.doesNotMatch(http + control, /VAPID_PRIVATE_KEY|CSS_ADMIN_PUSH_SUBJECT/);
  assert.match(dispatcher, /CSS_ADMIN_PUSH_ENV_FILE/);
});

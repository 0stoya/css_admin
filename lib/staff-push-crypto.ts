import {
  createCipheriv, createDecipheriv, createECDH, createHash, createHmac,
  createPrivateKey, randomBytes, sign,
} from "node:crypto";

export type BrowserPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

function bytes64(value: string, size: number, label: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid " + label + ".");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== size || bytes.toString("base64url") !== value.replace(/=+$/, "")) {
    throw new Error("Invalid " + label + " length.");
  }
  return bytes;
}

export function validatedPushSubscription(value: unknown): BrowserPushSubscription {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid browser push subscription.");
  }
  const obj = value as Record<string, unknown>;
  const keys = obj.keys;
  if (typeof obj.endpoint !== "string" || obj.endpoint.length > 4096 ||
      !keys || typeof keys !== "object" || Array.isArray(keys)) {
    throw new Error("Invalid browser push subscription.");
  }
  const pair = keys as Record<string, unknown>;
  if (typeof pair.p256dh !== "string" || typeof pair.auth !== "string") {
    throw new Error("Invalid browser push key material.");
  }
  let url: URL;
  try { url = new URL(obj.endpoint); }
  catch { throw new Error("Invalid browser push endpoint."); }
  if (url.protocol !== "https:" || url.port || url.username || url.password ||
      url.hash || !PUSH_HOSTS.has(url.hostname) || url.pathname === "/") {
    throw new Error("Push provider is not allowlisted.");
  }
  if (bytes64(pair.p256dh, 65, "public key")[0] !== 4) {
    throw new Error("Invalid P-256 push public key.");
  }
  bytes64(pair.auth, 16, "authentication secret");
  return { endpoint: url.toString(), keys: { p256dh: pair.p256dh, auth: pair.auth } };
}

export function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function encryptionKey() {
  const raw = process.env.CSS_ADMIN_PUSH_ENCRYPTION_KEY;
  if (!raw) throw new Error("Staff push encryption key is not configured.");
  return bytes64(raw, 32, "server encryption key");
}

export function sealPushSubscription(
  value: BrowserPushSubscription, ownerId: number, deviceId: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(ownerId + ":" + deviceId, "utf8"));
  const plain = Buffer.from(JSON.stringify(value));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64url");
}

export function openPushSubscription(sealed: string, ownerId: number, deviceId: string) {
  const blob = Buffer.from(sealed, "base64url");
  if (blob.length < 29) throw new Error("Invalid sealed push subscription.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), blob.subarray(0, 12));
  decipher.setAAD(Buffer.from(ownerId + ":" + deviceId, "utf8"));
  decipher.setAuthTag(blob.subarray(12, 28));
  const clear = Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
  return validatedPushSubscription(JSON.parse(clear.toString("utf8")));
}

function vapidConfiguration() {
  const publicKey = process.env.CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.CSS_ADMIN_PUSH_VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.CSS_ADMIN_PUSH_SUBJECT ?? "";
  const pub = bytes64(publicKey, 65, "VAPID public key");
  const privateBytes = bytes64(privateKey, 32, "VAPID private key");
  if (pub[0] !== 4 || !/^mailto:[^\s@]+@[^\s@]+$/.test(subject)) {
    throw new Error("Invalid VAPID key or contact subject.");
  }
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateBytes);
  if (!ecdh.getPublicKey().equals(pub)) throw new Error("VAPID key pair does not match.");
  return {
    publicKey,
    privateKey: createPrivateKey({
      key: {
        kty: "EC", crv: "P-256",
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33).toString("base64url"),
        d: privateBytes.toString("base64url"),
      },
      format: "jwk",
    }),
    subject,
  };
}

export function assertPushDispatcherConfiguration() {
  vapidConfiguration();
  encryptionKey();
}

export function verifiedVapidPublicKey() {
  // The web process needs only the *public* VAPID key, never the signing key.
  const publicKey = process.env.CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY ?? "";
  if (bytes64(publicKey, 65, "VAPID public key")[0] !== 4) {
    throw new Error("Invalid VAPID public key.");
  }
  return publicKey;
}

function base64Json(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function authorization(endpoint: string) {
  const keys = vapidConfiguration();
  const aud = new URL(endpoint).origin;
  const header = base64Json({ typ: "JWT", alg: "ES256" });
  const payload = base64Json({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  });
  const input = header + "." + payload;
  const signature = sign("sha256", Buffer.from(input), {
    key: keys.privateKey, dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return "vapid t=" + input + "." + signature + ", k=" + keys.publicKey;
}

export function encryptWebPushPayload(
  sub: BrowserPushSubscription, content: string,
) {
  const targetPublic = bytes64(sub.keys.p256dh, 65, "public key");
  const auth = bytes64(sub.keys.auth, 16, "auth");
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(targetPublic);
  const info = Buffer.concat([
    Buffer.from("WebPush: info\0"), targetPublic, serverPublic,
  ]);
  const hkdf = (ikm: Buffer, salt: Buffer, context: Buffer, length: number) => {
    // RFC5869 HKDF-Extract + HKDF-Expand, using SHA-256.
    const prk = createHmac("sha256", salt).update(ikm).digest();
    const okm = createHmac("sha256", prk).update(Buffer.concat([context, Buffer.from([1])])).digest();
    return okm.subarray(0, length);
  };
  const ikm = hkdf(secret, auth, info, 32);
  const salt = randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);
  const plaintext = Buffer.concat([Buffer.from(content), Buffer.from([2])]);
  if (plaintext.length > 4096 - 16) throw new Error("Web Push payload is too large.");
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt, size, Buffer.from([serverPublic.length]), serverPublic, encrypted,
  ]);
}

export async function sendExportReadyPush(sub: BrowserPushSubscription) {
  const approved = validatedPushSubscription(sub);
  // No job IDs, company names, SKUs or sensitive data in a lock-screen push.
  const encrypted = encryptWebPushPayload(approved, JSON.stringify({ event: "export_ready" }));
  const response = await fetch(approved.endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      Urgency: "normal",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      Authorization: authorization(approved.endpoint),
    },
    body: new Uint8Array(encrypted),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  // Provider responses are untrusted; never log their bodies or endpoints.
  return response.status;
}

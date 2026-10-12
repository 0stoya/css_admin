import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const manifest = load(root, "lib/pwa-manifest.ts");

test("Staff and Portal manifests have distinct stable install IDs and start locations", () => {
  const admin = manifest.pwaManifest("staff");
  const portal = manifest.pwaManifest("portal");
  assert.equal(admin.start_url, "/companies");
  assert.equal(portal.start_url, "/portal");
  assert.notEqual(admin.id, portal.id);
  for (const m of [admin, portal]) {
    assert.equal(m.scope, "/");
    assert.equal(m.display, "standalone");
    assert.equal(m.theme_color, "#0057a8");
    assert.deepEqual(Array.from(m.icons, icon => icon.sizes), ["192x192", "512x512"]);
    assert.ok(m.icons.every(icon => icon.type === "image/png" && icon.src.startsWith("/pwa/icon/")));
    assert.ok(m.icons.some(icon => icon.purpose.includes("maskable")));
    assert.doesNotMatch(JSON.stringify(m), /email|customer_id|admin_user_id|token|secret|order_number/i);
  }
});

test("PWA manifest routes are public and cache only non-sensitive metadata", () => {
  for (const surface of ["admin", "portal"]) {
    const route = source("app/pwa/" + surface + ".webmanifest/route.ts");
    assert.match(route, /application\/manifest\+json/);
    assert.match(route, /Cache-Control/);
    assert.match(route, /pwaManifest/);
    assert.doesNotMatch(route, /getAdminToken|getCompanyToken|cookies\(|graphqlRequest|database|export_job/);
  }
});

test("PWA icons have an allowlisted size, brand colours and no session dependency", () => {
  const icon = source("app/pwa/icon/[size]/route.tsx");
  for (const size of ["180", "192", "512"]) assert.match(icon, new RegExp(size));
  assert.match(icon, /ImageResponse/);
  assert.match(icon, /#0057a8/);
  assert.match(icon, /#ffdd00/);
  assert.match(icon, /status: 404/);
  assert.doesNotMatch(icon, /cookies\(|graphqlRequest|getAdminToken|customer_id/);
});

test("service worker is explicitly network only — no private response caching or interception", () => {
  const sw = source("public/sw.js");
  assert.match(sw, /addEventListener\("install"/);
  assert.match(sw, /addEventListener\("activate"/);
  assert.doesNotMatch(sw, /addEventListener\(["']fetch|caches\.|cache\.put|indexedDB|localStorage/);
  assert.doesNotMatch(sw, /addEventListener\(["']push|pushManager\.subscribe|showNotification/);
  const swConfig = source("next.config.ts");
  assert.match(swConfig, /source: "\/sw\.js"/);
  assert.match(swConfig, /Service-Worker-Allowed/);
  assert.match(swConfig, /no-cache, no-store, must-revalidate/);
});

test("registration occurs only inside separately authenticated Staff and Portal layouts", () => {
  const admin = source("app/(admin)/layout.tsx");
  const portal = source("app/(portal)/layout.tsx");
  const root = source("app/layout.tsx");
  const registration = source("components/pwa-service-worker.tsx");
  assert.match(admin, /if \(!\(await getAdminToken\(\)\)\)/);
  assert.match(portal, /if \(!\(await getCompanyToken\(\)\)\)/);
  assert.match(admin, /<PwaServiceWorker \/>/);
  assert.match(portal, /<PwaServiceWorker \/>/);
  assert.doesNotMatch(root, /<PwaServiceWorker/);
  assert.match(admin, /manifest: "\/pwa\/admin\.webmanifest"/);
  assert.match(portal, /manifest: "\/pwa\/portal\.webmanifest"/);
  assert.match(registration, /navigator\.serviceWorker\.register\("\/sw\.js"/);
  assert.match(registration, /updateViaCache: "none"/);
  assert.doesNotMatch(registration, /cache\.addAll|pushManager|localStorage/);
});

test("installation is optional and requires the browser UI or a user click", () => {
  const component = source("components/pwa-install-control.tsx");
  const staff = source("components/app-header.tsx");
  const portal = source("components/portal/portal-header.tsx");
  assert.match(component, /beforeinstallprompt/);
  assert.match(component, /appinstalled/);
  assert.match(component, /prompt\(\)/);
  assert.match(component, /userChoice/);
  assert.match(component, /Add to Home Screen/);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(staff, /<PwaInstallControl surface="staff"/);
  assert.match(portal, /<PwaInstallControl surface="portal"/);
  assert.doesNotMatch(component, /Notification\.requestPermission|pushManager\.subscribe/);
});

test("customer/store approval identity stays separate from staff export ownership", () => {
  const owner = source("lib/admin-export-jobs.ts");
  const auth = source("lib/admin-job-auth.ts");
  const docs = source("docs/CSS_PWA_INSTALL_AND_NOTIFICATIONS.md");
  assert.match(owner, /owner_admin_user_id/);
  assert.match(auth, /css_admin_current_user/);
  assert.match(docs, /css_company_context/);
  assert.match(docs, /customer_id/);
  assert.match(docs, /can_approve/);
  assert.match(docs, /css_store/);
  assert.match(docs, /No Fluid deployment is required for PR #136/);
  assert.match(docs, /There is no push subscription/i);
});

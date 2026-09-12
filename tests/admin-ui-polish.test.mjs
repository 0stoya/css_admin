import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const help = load(root, "lib/admin-context-help.ts");

const expected = [
  ["/companies/12/finance", "finance"],
  ["/companies/12/management", "management"],
  ["/companies/12/employees", "employees"],
  ["/companies/12/catalog", "catalog"],
  ["/companies/12/payment", "payment"],
  ["/companies/12/credit", "credit"],
  ["/companies/12/credit-orders", "credit-orders"],
  ["/companies/12/credit-orders/CO-100", "credit-orders"],
  ["/companies/12/pricing", "pricing"],
  ["/companies/12/import-export", "import-export"],
  ["/companies/12/personalisation", "personalisation"],
  ["/companies/12/settings", "settings"],
  ["/bulk-import", "bulk-import"],
  ["/ogl", "ogl"],
  ["/ogl/rep-profiles", "rep-profiles"],
];

for (const [pathname, key] of expected) {
  test(`${pathname} has contextual admin help`, () => {
    assert.equal(help.adminHelpForPathname(pathname)?.key, key);
  });
}

for (const pathname of [
  "/companies",
  "/companies/12",
  "/companies/12/purchase-controls",
  "/portal",
  "/portal/purchase-controls",
  "/login",
]) {
  test(`${pathname} intentionally has no generic admin help`, () => {
    assert.equal(help.adminHelpForPathname(pathname), null);
  });
}

test("admin shell owns the contextual helper and Company Portal stays outside it", () => {
  const adminLayout = source("app/(admin)/layout.tsx");
  const portalLayout = source("app/(portal)/layout.tsx");
  assert.match(adminLayout, /className="shell admin-shell"/);
  assert.match(adminLayout, /<AdminContextHelp\s*\/>/);
  assert.doesNotMatch(portalLayout, /admin-shell|AdminContextHelp/);
});

test("admin sidebar icons are explicitly gated to the Admin product label", () => {
  const sidebar = source("components/app-sidebar.tsx");
  assert.match(sidebar, /const showAdminIcons = productLabel === "Admin"/);
  assert.match(sidebar, /app-sidebar-admin-icons/);
  assert.match(sidebar, /adminCompanyIcons/);
  assert.match(sidebar, /adminSectionIcons/);
});

test("root layout loads a dedicated admin visual layer", () => {
  const layout = source("app/layout.tsx");
  assert.match(layout, /import "\.\/admin-visual-polish\.css";/);
  const css = source("app/admin-visual-polish.css");
  assert.match(css, /\.admin-shell \.admin-context-help-trigger/);
  assert.match(css, /\.admin-shell \.app-sidebar-admin-icons/);
  assert.doesNotMatch(css, /\.portal-/);
});

test("audit records the complete admin route set and avoids duplicate purchase-control help", () => {
  const audit = source("docs/ADMIN_UI_POLISH_AUDIT.md");
  for (const fragment of [
    "`/companies`",
    "`/companies/[id]`",
    "`/companies/[id]/finance`",
    "`/companies/[id]/management`",
    "`/companies/[id]/employees`",
    "`/companies/[id]/catalog`",
    "`/companies/[id]/purchase-controls`",
    "`/companies/[id]/payment`",
    "`/companies/[id]/credit`",
    "`/companies/[id]/credit-orders`",
    "`/companies/[id]/credit-orders/[number]`",
    "`/companies/[id]/pricing`",
    "`/companies/[id]/import-export`",
    "`/companies/[id]/personalisation`",
    "`/companies/[id]/settings`",
    "`/bulk-import`",
    "`/ogl`",
    "`/ogl/rep-profiles`",
  ]) assert.ok(audit.includes(fragment), `missing audit entry: ${fragment}`);
  assert.match(audit, /purchase controls keep their existing specialist help modal/i);
  assert.match(audit, /Company Portal.*out of scope/i);
});

test("contextual help uses the existing native dialog instead of another modal implementation", () => {
  const component = source("components/admin-context-help.tsx");
  assert.match(component, /PurchaseControlDialog/);
  assert.match(component, /createPortal/);
  assert.match(component, /main\.content h1/);
  assert.match(component, /<Info /);
  assert.doesNotMatch(component, /<dialog/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const { sectionChildIsActive } = load(root, "lib/admin-sidebar-routing.ts");

test("CRM Migrations and Help match their original and nested URLs", () => {
  assert.equal(sectionChildIsActive("/crm", "", "/crm"), true);
  assert.equal(sectionChildIsActive("/migrations", "", "/migrations", true), true);
  assert.equal(sectionChildIsActive("/migrations/123", "", "/migrations", true), true);
  assert.equal(sectionChildIsActive("/help", "", "/help", true), true);
  assert.equal(sectionChildIsActive("/help/articles", "", "/help", true), true);
  assert.equal(sectionChildIsActive("/migrations-other", "", "/migrations", true), false);
  assert.equal(sectionChildIsActive("/companies/123", "", "/migrations", true), false);
  assert.equal(sectionChildIsActive("/migrations/123", "", "/migrations"), false);
});

test("OGL and Bulk Import query subnavigation keeps exact-view highlighting", () => {
  assert.equal(sectionChildIsActive("/bulk-import", "", "/bulk-import"), true);
  assert.equal(sectionChildIsActive("/bulk-import", "view=users", "/bulk-import"), false);
  assert.equal(sectionChildIsActive("/bulk-import", "view=users", "/bulk-import?view=users"), true);
  assert.equal(sectionChildIsActive("/bulk-import", "view=roles", "/bulk-import?view=users"), false);
  assert.equal(sectionChildIsActive("/ogl", "", "/ogl"), true);
  assert.equal(sectionChildIsActive("/ogl", "view=mappings", "/ogl"), false);
  assert.equal(sectionChildIsActive("/ogl", "view=mappings", "/ogl?view=mappings"), true);
  assert.equal(sectionChildIsActive("/ogl/rep-profiles", "", "/ogl"), false);
  assert.equal(sectionChildIsActive("/ogl/rep-profiles", "", "/ogl/rep-profiles"), true);
});

test("Staff Admin navigation has CRM and Settings without duplicate Migrations and Help top-level items", () => {
  const layout = source("app/(admin)/layout.tsx");
  const top = layout.split("const navigation: NavigationItem[] = [")[1]
    .split("const companyNavigation: CompanySidebarNavigationItem[] = [")[0];
  assert.match(top, /href: "\/companies", label: "Companies"/);
  assert.match(top, /href: "\/jobs", label: "Export jobs"/);
  assert.match(top, /href: "\/bulk-import", label: "Bulk import"/);
  assert.match(top, /href: "\/ogl", label: "OGL"/);
  assert.match(top, /href: "\/crm", label: "CRM"/);
  assert.match(top, /activePaths: \["\/migrations", "\/help"\]/);
  assert.match(top, /href: "\/settings", label: "Settings"/);
  assert.doesNotMatch(top, /href: "\/migrations"|href: "\/help"/);
  assert.match(layout, /parentHref: "\/crm"/);
  assert.match(layout, /href: "\/migrations", label: "Migrations", matchDescendants: true/);
  assert.match(layout, /href: "\/help", label: "Help & guides", matchDescendants: true/);
  assert.match(layout, /if \(!\(await getAdminToken\(\)\)\)/);
});

test("CRM parent stays active for migrated child routes without altering other submenu behavior", () => {
  const sidebar = source("components/app-sidebar.tsx");
  assert.match(sidebar, /const active = isActive\(pathname, item\) \|\| staticChildCurrent/);
  assert.match(sidebar, /sectionChildIsActive\(pathname, currentQuery, child\.href, child\.matchDescendants\)/);
  assert.match(sidebar, /const showStaticSection = Boolean\(staticSection && active\)/);
  assert.match(sidebar, /aria-current=\{childActive \? "page" : undefined\}/);
  assert.match(sidebar, /"\/crm": Handshake/);
  assert.match(sidebar, /"\/settings": Settings/);
  assert.match(sidebar, /item\.activePaths\?\.some/);
  assert.match(source("components/app-header.tsx"), /item\.activePaths\?\.some/);
});

test("Staff device alerts and install control live in Settings, while the Jobs bell stays in header", () => {
  const settings = source("app/(admin)/settings/page.tsx");
  const jobs = source("app/(admin)/jobs/page.tsx");
  const header = source("components/app-header.tsx");
  const portalHeader = source("components/portal/portal-header.tsx");
  const component = source("components/staff-export-push-controls.tsx");
  assert.match(settings, /<StaffExportPushControls \/>/);
  assert.match(settings, /<PwaInstallControl surface="staff" \/>/);
  assert.match(settings, /Export notifications/);
  assert.match(settings, /Install CSS Admin/);
  assert.doesNotMatch(jobs, /<StaffExportPushControls/);
  assert.doesNotMatch(header, /<PwaInstallControl surface="staff"/);
  assert.match(header, /<AdminExportJobBell \/>/);
  assert.match(portalHeader, /<PwaInstallControl surface="portal" \/>/);
  assert.match(source("app/(admin)/layout.tsx"), /<PwaInstallPromptProvider>/);
  assert.match(source("app/(portal)/layout.tsx"), /<PwaInstallPromptProvider>/);
  assert.match(component, /Notification\.requestPermission\(\)/);
  assert.match(component, /method: "DELETE"/);
});

test("CRM links to the existing Migrations and Help implementations", () => {
  const crm = source("app/(admin)/crm/page.tsx");
  assert.match(crm, /href="\/migrations"/);
  assert.match(crm, /href="\/help"/);
  assert.match(crm, /Portal/);
  assert.match(source("app/(admin)/migrations/page.tsx"), /export default/);
  assert.match(source("app/(admin)/help/page.tsx"), /export default/);
});

test("No new unguarded endpoints, Magento mutations, or permissions are introduced", () => {
  const settings = source("app/(admin)/settings/page.tsx");
  const crm = source("app/(admin)/crm/page.tsx");
  const layout = source("app/(admin)/layout.tsx");
  assert.doesNotMatch(settings + crm, /cssAdmin|graphqlRequest|mutation |getLocalPostgres|process\.env|fetch\(/);
  assert.match(layout, /getAdminToken\(\)/);
});

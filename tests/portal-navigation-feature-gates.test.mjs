import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Portal navigation separates Company profile, Users and Roles", () => {
  const layout = source("app/(portal)/layout.tsx");
  const sidebar = source("components/portal/portal-sidebar.tsx");

  assert.match(layout, /href: "\/portal\/company-profile", label: "Company profile"/);
  assert.match(layout, /href: "\/portal\?view=users#portal-users", label: "Users"/);
  assert.match(layout, /href: "\/portal\?view=roles#portal-roles", label: "Roles"/);
  assert.match(layout, /capabilities\?\.can_view_users/);
  assert.match(layout, /capabilities\?\.can_view_roles/);
  assert.doesNotMatch(layout, /href: "\/portal", label: "Company", exact: true/);

  assert.match(sidebar, /useSearchParams/);
  assert.match(sidebar, /new URLSearchParams\(query\)/);
  assert.match(sidebar, /current\.get\(key\) !== value/);
});

test("Portal Employees navigation requires staff-enabled employee ordering", () => {
  const layout = source("app/(portal)/layout.tsx");
  const dashboard = source("app/(portal)/portal/page.tsx");

  assert.match(layout, /employeeResult\.status === "fulfilled"\s*&& employeeResult\.value\.uses_employee/);
  assert.match(layout, /canViewEmployees \? \[\{ href: "\/portal\/employees"/);
  assert.match(dashboard, /employeeResult\.status === "fulfilled" && employeeResult\.value\.uses_employee/);
});

test("direct Portal Employees URL stops before loading employee data when feature is disabled", () => {
  const page = source("app/(portal)/portal/employees/page.tsx");

  const gate = page.indexOf("if (!configuration.uses_employee)");
  const employeeFetch = page.indexOf("getPortalEmployees({", gate);

  assert.ok(gate >= 0);
  assert.ok(employeeFetch > gate);
  assert.match(page, /Employees not enabled/);
  assert.match(page, /has not been enabled for this company by Chelmsford Safety Supplies/);
});

test("Portal employee writes and exports enforce the staff feature gate", () => {
  const actions = source("app/(portal)/portal/employees/actions.ts");
  const exportRoute = source("app/api/portal/employees/export/route.ts");

  assert.match(actions, /async function requireEmployeeFeatureEnabled/);
  assert.match(actions, /await requireEmployeeFeatureEnabled\(\)/);
  assert.match(actions, /createPortalEmployeeAction/);
  assert.match(actions, /updatePortalEmployeeAction/);
  assert.match(actions, /deactivatePortalEmployeeAction/);
  assert.match(actions, /importPortalEmployeesCsvAction/);

  assert.match(exportRoute, /getPortalEmployeeConfiguration/);
  assert.match(exportRoute, /if \(!configuration\.uses_employee\)/);
  assert.match(exportRoute, /status: 404/);
});

test("Portal admin cannot enable or disable the employee feature", () => {
  const page = source("app/(portal)/portal/employees/page.tsx");
  const actions = source("app/(portal)/portal/employees/actions.ts");
  const staffPage = source("app/(admin)/companies/[id]/employees/page.tsx");

  assert.doesNotMatch(page, /name="usesEmployee"/);
  assert.match(page, /Employee ordering is enabled for this company by Chelmsford Safety Supplies/);
  assert.match(page, /name="multiEmployeeBasket"/);

  assert.doesNotMatch(actions, /formData\.get\("usesEmployee"\)/);
  assert.match(actions, /getPortalEmployeeConfiguration\(\)/);
  assert.match(actions, /if \(!current\.uses_employee\)/);
  assert.match(actions, /uses_employee: true/);

  assert.match(staffPage, /name="usesEmployee"/);
  assert.match(staffPage, /saveEmployeeConfigurationAction/);
});

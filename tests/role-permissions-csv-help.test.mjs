import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const generatedPermissionHeaders = [
  "Sales",
  "Sales > Allow Checkout",
  "Sales > Allow Checkout > Use Pay On Account method",
  "Sales > View orders",
  "Sales > View orders > View all company orders",
  "Company Credit Orders",
  "Company Credit Orders > View Own Credit Orders",
  "Company Credit Orders > View All Company Credit Orders",
  "Company Credit Orders > Approve/Reject Credit Orders",
  "Company Credit Orders > Auto-approve own credit orders",
  "Company Credit Orders > Enter PO Numbers",
  "Company Profile",
  "Company Profile > Account Information (View)",
  "Company Profile > Legal Address (View)",
  "Company Profile > Contacts (View)",
  "Company Profile > Payment Information (View)",
  "Company User Management",
  "Company User Management > Impersonation of company users",
  "Company User Management > View roles and permissions",
  "Company User Management > View roles and permissions > Manage roles and permissions",
  "Company User Management > View users",
  "Company User Management > View users > Manage users",
  "Access Public Catalog",
  "Manage Catalog Visibility",
  "Employees",
  "Employees > View Employees",
  "Employees > Manage Employees",
  "Purchase Controls",
  "Purchase Controls > View Purchase Controls",
  "Purchase Controls > Manage Purchase Controls",
  "Account Representative",
  "Account Representative > View Account Representative",
  "Company Credit",
  "Company Credit > View",
  "Company Credit > Edit",
];

test("roles CSV guide documents every current generated permission header", () => {
  const guide = source("components/role-permissions-csv-help.tsx");

  assert.equal(generatedPermissionHeaders.length, 35);
  for (const header of generatedPermissionHeaders) {
    assert.ok(
      guide.includes(`parameter: "${header}"`),
      `missing guide entry for ${header}`,
    );
  }
});

test("roles CSV guide explains fixed fields, values and replacement semantics", () => {
  const guide = source("components/role-permissions-csv-help.tsx");

  assert.match(guide, /parameter: "user_role"/);
  assert.match(guide, /parameter: "company_ref"/);
  assert.match(guide, /parameter: "sort_order"/);
  assert.match(guide, /Allow: 1 · true · yes · y/);
  assert.match(guide, /Do not allow: 0 · false · no · n · blank/);
  assert.match(guide, /complete desired set of assignable permissions/);
  assert.match(guide, /up to 5,000 data rows/);
  assert.match(guide, /does not itself edit catalogue restrictions/);
  assert.match(guide, /role name\/sort order\/allowed resources only/);
});

test("roles CSV guide is surfaced in company and bulk role import workspaces", () => {
  const companyImports = source("components/flat-company-imports.tsx");
  const bulkImports = source("components/bulk-import-workspace.tsx");

  assert.match(companyImports, /RolePermissionsCsvHelp/);
  assert.match(companyImports, /showRolePermissionsGuide/);
  assert.match(bulkImports, /RolePermissionsCsvHelp/);
  assert.match(bulkImports, /showRolePermissionsGuide/);
});

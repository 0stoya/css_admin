import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function parseCsv(source) {
  return source.trim().split(/\r?\n/).map((line) => line.split(","));
}

function harness() {
  const calls = [];
  const company = {
    company_id: 1455,
    reference: "EAS046",
    name: "East Suffolk Services Ltd",
  };
  const management = {
    company_id: 1455,
    users: [],
    roles: [
      {
        role_id: 10,
        name: "Demo 1",
        sort_order: 0,
        allowed_resources: ["Protected::root"],
        user_count: 0,
        manageable: true,
      },
    ],
    resources: [
      {
        resource_id: "Protected::root",
        title: "All",
        parent_resource_id: null,
        depth: 0,
        assignable: false,
      },
      {
        resource_id: "Fluid::orders",
        title: "Orders",
        parent_resource_id: "Protected::root",
        depth: 1,
        assignable: true,
      },
    ],
  };

  const imports = {
    "@/lib/csv": { parseCsv },
    "@/lib/graphql/companies": {
      getCompany: async (companyId) => {
        assert.equal(companyId, 1455);
        return company;
      },
      getCompanies: async () => {
        throw new Error("Locked-company preview must not enumerate every company.");
      },
    },
    "@/lib/graphql/company-management": {
      getCompanyManagement: async (companyId) => {
        assert.equal(companyId, 1455);
        return management;
      },
    },
    "@/lib/graphql/company-controls": {
      importCompanyControls: async (input) => {
        calls.push(structuredClone(input));
        if (input.format !== "fluid-company-role-controls") {
          throw new Error("The product that was requested doesn't exist. Verify the product and try again.");
        }
        return {
          valid: true,
          applied: !input.dry_run,
        };
      },
    },
    "@/lib/import-export-types": {},
  };

  return {
    roleImports: load(root, "lib/role-permissions-imports.ts", imports),
    calls,
  };
}

const csv = [
  "user_role,company_ref,sort_order,Orders",
  "Demo 1,EAS046,1,1",
  "Demo 2,EAS046,2,1",
].join("\n");

test("roles preview uses the role-only backend format and never sends product state", async () => {
  const { roleImports, calls } = harness();

  const rows = await roleImports.previewRolesPermissionsCsv(csv, {
    lockedCompanyId: 1455,
    createMissingRoles: true,
  });

  assert.deepEqual(rows.map((row) => row.status), ["Updated", "Created"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].format, "fluid-company-role-controls");
  assert.equal(calls[0].schema_version, 1);
  assert.equal(calls[0].company_catalog.product_restriction, false);
  assert.deepEqual(calls[0].company_catalog.allowed_product_skus, []);
  assert.equal(calls[0].purchase_controls, undefined);
  assert.deepEqual(
    calls[0].role_controls.map((role) => ({
      name: role.role_name,
      categories: role.selected_category_ids,
      products: role.allowed_product_skus,
    })),
    [
      { name: "Demo 1", categories: [], products: [] },
      { name: "Demo 2", categories: [], products: [] },
    ],
  );
  assert.deepEqual(calls[0].role_controls[0].allowed_resources.sort(), ["Fluid::orders", "Protected::root"]);
});

test("roles apply validates then applies only the role-only transaction", async () => {
  const { roleImports, calls } = harness();

  const rows = await roleImports.applyRolesPermissionsCsv(csv, {
    lockedCompanyId: 1455,
    createMissingRoles: true,
  });

  assert.deepEqual(calls.map((input) => input.dry_run), [true, false]);
  assert.ok(calls.every((input) => input.format === "fluid-company-role-controls"));
  assert.deepEqual(rows.map((row) => row.message), ["Updated by Fluid.", "Created by Fluid."]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function parseCsv(source) {
  return source.trim().split(/\r?\n/).map((line) => line.split(","));
}

function harness({ failAt = null } = {}) {
  const saveCalls = [];
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
      saveCompanyRole: async (companyId, input) => {
        assert.equal(companyId, 1455);
        saveCalls.push(structuredClone(input));
        if (failAt === saveCalls.length) throw new Error("Role save rejected.");
        return {
          role_id: input.role_id ?? 11,
          name: input.name,
          sort_order: input.sort_order ?? 0,
          allowed_resources: input.allowed_resources,
          user_count: 0,
          manageable: true,
        };
      },
    },
    "@/lib/import-export-types": {},
  };

  return {
    roleImports: load(root, "lib/role-permissions-imports.ts", imports),
    saveCalls,
  };
}

const csv = [
  "user_role,company_ref,sort_order,Orders",
  "Demo 1,EAS046,1,1",
  "Demo 2,EAS046,2,1",
].join("\n");

test("roles preview validates only role data and performs no backend writes", async () => {
  const { roleImports, saveCalls } = harness();

  const rows = await roleImports.previewRolesPermissionsCsv(csv, {
    lockedCompanyId: 1455,
    createMissingRoles: true,
  });

  assert.deepEqual(rows.map((row) => row.status), ["Updated", "Created"]);
  assert.deepEqual(saveCalls, []);
});

test("roles apply uses only cssAdminSaveCompanyRole-compatible inputs", async () => {
  const { roleImports, saveCalls } = harness();

  const rows = await roleImports.applyRolesPermissionsCsv(csv, {
    lockedCompanyId: 1455,
    createMissingRoles: true,
  });

  assert.equal(saveCalls.length, 2);
  assert.deepEqual(saveCalls[0], {
    role_id: 10,
    name: "Demo 1",
    sort_order: 1,
    allowed_resources: ["Protected::root", "Fluid::orders"],
  });
  assert.deepEqual(saveCalls[1], {
    name: "Demo 2",
    sort_order: 2,
    allowed_resources: ["Fluid::orders"],
  });
  assert.ok(saveCalls.every((input) => !("allowed_product_skus" in input)));
  assert.ok(saveCalls.every((input) => !("selected_category_ids" in input)));
  assert.deepEqual(rows.map((row) => row.message), ["Updated by Fluid.", "Created by Fluid."]);
});

test("roles apply reports the exact role mutation failure without product coupling", async () => {
  const { roleImports, saveCalls } = harness({ failAt: 2 });

  const rows = await roleImports.applyRolesPermissionsCsv(csv, {
    lockedCompanyId: 1455,
    createMissingRoles: true,
  });

  assert.equal(saveCalls.length, 2);
  assert.equal(rows[0].status, "Updated");
  assert.equal(rows[1].status, "Error");
  assert.match(rows[1].message, /Role save rejected/);
  assert.doesNotMatch(rows[1].message, /product/i);
});

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const csv = load(root, "lib/csv.ts");

function company(index) {
  const reference = `AMS${String(index).padStart(3, "0")}`;
  return {
    company_id: index,
    reference,
    name: `Child ${index}`,
    status: true,
    sales_representative_id: null,
    parent_company_id: 999,
  };
}

function management(index) {
  return {
    company_id: index,
    users: [],
    roles: [{
      role_id: index * 10,
      name: "Access All",
      sort_order: 10,
      allowed_resources: [],
      user_count: 0,
      purchase_employee_count: 0,
      manageable: true,
    }],
    resources: [],
  };
}

function harness(companies) {
  const saves = [];

  const flat = load(root, "lib/flat-company-imports.ts", {
    "@/lib/csv": csv,
    "@/lib/graphql/companies": {
      getCompanies: async (page) => ({
        items: page === 1 ? companies : [],
        page_info: { current_page: page, total_pages: 1 },
      }),
      getCompany: async () => {
        throw new Error("bulk role-product preview should resolve by company_ref");
      },
    },
    "@/lib/graphql/company-management": {
      getCompanyManagement: async (companyId) => management(companyId),
      addCompanyUser: async () => { throw new Error("not used"); },
      getCompanyCustomerCandidates: async () => ({ items: [] }),
      updateCompanyUser: async () => { throw new Error("not used"); },
    },
    "@/lib/graphql/company-controls": {
      getCompanyControlsBundle: async () => {
        throw new Error("role-product imports must not export full company controls");
      },
      importCompanyControls: async () => {
        throw new Error("role-product imports must not use generic company-control import");
      },
    },
    "@/lib/graphql/catalog-policy": {
      resolveProductIdsBySkus: async (skus) => new Map(
        [...new Set(skus)].map((sku) => [
          sku,
          sku === "A800" ? 800 : sku === "A800/07" ? 807 : 999,
        ]),
      ),
      getRoleCatalogPolicy: async (companyId, roleId) => ({
        company_id: companyId,
        role_id: roleId,
        category_tree: [],
        selected_category_ids: [12],
        expanded_category_ids: [12],
        has_saved_categories: true,
        show_product_grid: true,
        products_count: 0,
        preselect_all_products: false,
        allowed_product_ids: [],
        products: {
          total_count: 0,
          page: 1,
          page_size: 50,
          preselect_all: false,
          items: [],
        },
      }),
      saveRoleCatalogProducts: async (
        companyId,
        roleId,
        allowedProductIds,
        preselectAll,
        deselectedProductIds,
      ) => {
        saves.push({
          companyId,
          roleId,
          allowedProductIds: [...allowedProductIds],
          preselectAll,
          deselectedProductIds: [...deselectedProductIds],
        });
      },
    },
    "@/lib/import-export-types": {},
  });

  return { flat, saves };
}

function sourceFor(companies) {
  const rows = ["sku,user_role_name,company_ref"];

  for (const item of companies) {
    rows.push(`A800,Access All,${item.reference}`);
    rows.push(`A800/07,Access All,${item.reference}`);
    rows.push(`A800/07,Access All,${item.reference}`);
  }

  return rows.join("\n");
}

test("role-product preview groups the same role name independently across 35 child companies", async () => {
  const companies = Array.from({ length: 35 }, (_, index) => company(index + 1));
  const { flat, saves } = harness(companies);

  const preview = await flat.previewRoleProductsCsv(sourceFor(companies));

  assert.equal(preview.length, 35);
  assert.equal(saves.length, 0);
  assert.ok(preview.every((row) => row.item === "Access All"));
  assert.ok(preview.every((row) => row.status === "Updated"));
  assert.ok(preview.every((row) => /2 SKUs/.test(row.message)));
});

test("role-product apply uses the dedicated role-product mutation once per child company", async () => {
  const companies = Array.from({ length: 35 }, (_, index) => company(index + 1));
  const { flat, saves } = harness(companies);

  const result = await flat.applyRoleProductsCsv(sourceFor(companies));

  assert.equal(result.length, 35);
  assert.equal(saves.length, 35);
  assert.ok(result.every((row) => row.status === "Updated"));
  assert.ok(result.every((row) => row.message === "Updated by Fluid."));

  for (const item of companies) {
    const saved = saves.find((entry) => entry.companyId === item.company_id);
    assert.ok(saved);
    assert.equal(saved.roleId, item.company_id * 10);
    assert.deepEqual(Array.from(saved.allowedProductIds), [800, 807]);
    assert.equal(saved.preselectAll, false);
    assert.deepEqual(Array.from(saved.deselectedProductIds), []);
  }
});

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
      manageable: true,
    }],
    resources: [],
  };
}

function controls(index) {
  return {
    format: "fluid-company-controls",
    schema_version: 2,
    company_id: index,
    company_catalog: {
      allow_public_catalog: false,
      category_restriction: false,
      allowed_category_ids: [],
      product_restriction: false,
      allowed_product_skus: [],
    },
    role_controls: [{
      role_name: "Access All",
      sort_order: 10,
      allowed_resources: [],
      selected_category_ids: [],
      preselect_all_products: false,
      allowed_product_skus: [],
    }],
    purchase_controls: { templates: [] },
  };
}

function harness(companies) {
  const imports = [];
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
      getCompanyControlsBundle: async (companyId) => controls(companyId),
      importCompanyControls: async (input) => {
        imports.push(structuredClone(input));
        return {
          valid: true,
          applied: !input.dry_run,
          roles_created: 0,
          roles_updated: 0,
          role_controls_saved: 1,
          purchase_templates_created: 0,
          purchase_templates_updated: 0,
          purchase_templates_saved: 0,
          purchase_template_users_applied: 0,
        };
      },
    },
    "@/lib/import-export-types": {},
  });

  return { flat, imports };
}

test("role-product CSVs group identical role names independently across 35 child companies", async () => {
  const companies = Array.from({ length: 35 }, (_, index) => company(index + 1));
  const rows = ["sku,user_role_name,company_ref"];

  for (const item of companies) {
    rows.push(`A800,Access All,${item.reference}`);
    rows.push(`A800/07,Access All,${item.reference}`);
    rows.push(`A800/07,Access All,${item.reference}`); // duplicate must collapse
  }

  const { flat, imports } = harness(companies);
  const preview = await flat.previewRoleProductsCsv(rows.join("\n"));

  assert.equal(preview.length, 35);
  assert.equal(imports.length, 35);
  assert.ok(preview.every((row) => row.item === "Access All"));
  assert.ok(preview.every((row) => row.status === "Updated"));

  const byCompany = new Map(imports.map((input) => [input.company_id, input]));
  for (const item of companies) {
    const input = byCompany.get(item.company_id);
    assert.ok(input);
    assert.equal(input.dry_run, true);
    assert.deepEqual(
      Array.from(input.role_controls[0].allowed_product_skus),
      ["A800", "A800/07"],
    );
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const csv = load(root, "lib/csv.ts");
const HEADERS = "company_ref,record_type,template_name,sku,quantity_limit,duration_days,start_date,role_name";

function source(...rows) {
  return [HEADERS, ...rows].join("\n");
}

function templateSource(companyRef = "ABC001", templateName = "Monthly PPE", sku = "PPE-1") {
  return source(
    `${companyRef},purchase_template,${templateName},,,,,`,
    `${companyRef},purchase_rule,${templateName},${sku},4,30,2026-09-01,`,
    `${companyRef},template_role,${templateName},,,,,Buyer`,
  );
}

function harness({ unavailableSkus = [], failSaveCompanyId = null } = {}) {
  const companies = [
    { company_id: 11, reference: "ABC001", name: "Alpha", sales_representative_id: null, parent_company_id: null },
    { company_id: 22, reference: "XYZ002", name: "Beta", sales_representative_id: null, parent_company_id: null },
  ];
  const unavailable = new Set(unavailableSkus.map((sku) => sku.toLowerCase()));
  const saveCalls = [];
  const assignCalls = [];
  const applyCalls = [];
  const productChecks = [];
  const overviewByCompany = new Map([
    [11, { company_id: 11, templates: [] }],
    [22, { company_id: 22, templates: [] }],
  ]);
  const managementByCompany = new Map([
    [11, {
      company_id: 11,
      users: [],
      roles: [{ role_id: 7, name: "Buyer", sort_order: 0, allowed_resources: [], user_count: 0, manageable: true }],
      resources: [],
    }],
    [22, {
      company_id: 22,
      users: [],
      roles: [{ role_id: 8, name: "Buyer", sort_order: 0, allowed_resources: [], user_count: 0, manageable: true }],
      resources: [],
    }],
  ]);

  const imports = {
    "@/lib/csv": csv,
    "@/lib/graphql/companies": { getAllCompanies: async () => companies },
    "@/lib/graphql/company-catalog-products": {
      getCompanyCatalogProducts: async (companyId, _page, _pageSize, search) => {
        productChecks.push({ companyId, search });
        const sku = String(search ?? "");
        return {
          total_count: unavailable.has(sku.toLowerCase()) ? 0 : 1,
          items: unavailable.has(sku.toLowerCase()) ? [] : [{ product_id: 99, sku, name: `Product ${sku}` }],
          page_info: { page_size: 50, current_page: 1, total_pages: 1 },
        };
      },
    },
    "@/lib/graphql/company-management": {
      getCompanyManagement: async (companyId) => structuredClone(managementByCompany.get(companyId)),
    },
    "@/lib/graphql/purchase-controls": {
      getPurchaseControls: async (companyId) => structuredClone(overviewByCompany.get(companyId)),
      savePurchaseControlTemplate: async (companyId, input) => {
        saveCalls.push({ companyId, input: structuredClone(input) });
        if (companyId === failSaveCompanyId) throw new Error("Template save rejected.");
        return { cssAdminSavePurchaseControlTemplate: { template_id: input.template_id ?? companyId * 10, name: input.name } };
      },
      assignPurchaseControlTemplate: async (companyId, roleId, templateId, applyToUsers) => {
        assignCalls.push({ companyId, roleId, templateId, applyToUsers });
        return { cssAdminAssignPurchaseControlTemplate: { company_id: companyId, role_id: roleId, template_id: templateId } };
      },
      applyPurchaseControlTemplate: async (companyId, templateId) => {
        applyCalls.push({ companyId, templateId });
        return { cssAdminApplyPurchaseControlTemplate: { company_id: companyId, template_id: templateId, affected_users: 2 } };
      },
    },
    "@/lib/import-export-types": {},
  };

  return {
    bulk: load(root, "lib/bulk-purchase-controls-direct.ts", imports),
    saveCalls,
    assignCalls,
    applyCalls,
    productChecks,
    overviewByCompany,
  };
}

test("preview validates only CSV purchase controls and performs no writes", async () => {
  const { bulk, saveCalls, assignCalls, applyCalls, productChecks } = harness();
  const rows = await bulk.previewBulkPurchaseControlsCsv(templateSource(), {
    createMissingTemplates: true,
    applyPurchaseTemplates: true,
  });

  assert.deepEqual(Array.from(rows, (row) => row.status), ["Created"]);
  assert.equal(saveCalls.length, 0);
  assert.equal(assignCalls.length, 0);
  assert.equal(applyCalls.length, 0);
  assert.deepEqual(productChecks, [{ companyId: 11, search: "PPE-1" }]);
});

test("preview reports the exact unavailable CSV SKU instead of an unrelated generic product error", async () => {
  const { bulk, saveCalls } = harness({ unavailableSkus: ["BAD-SKU"] });
  const rows = await bulk.previewBulkPurchaseControlsCsv(templateSource("ABC001", "Monthly PPE", "BAD-SKU"), {
    createMissingTemplates: true,
    applyPurchaseTemplates: false,
  });

  assert.equal(rows[0].status, "Error");
  assert.match(rows[0].message, /BAD-SKU/);
  assert.match(rows[0].message, /not available in this company catalogue/i);
  assert.doesNotMatch(rows[0].message, /product that was requested/i);
  assert.equal(saveCalls.length, 0);
});

test("apply uses only dedicated purchase-control mutations", async () => {
  const { bulk, saveCalls, assignCalls, applyCalls } = harness();
  const rows = await bulk.applyBulkPurchaseControlsCsv(templateSource(), {
    createMissingTemplates: true,
    applyPurchaseTemplates: true,
  });

  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0], {
    companyId: 11,
    input: {
      name: "Monthly PPE",
      rules: [{ sku: "PPE-1", quantity_limit: 4, duration_days: 30, start_date: "2026-09-01" }],
    },
  });
  assert.deepEqual(assignCalls, [{ companyId: 11, roleId: 7, templateId: 110, applyToUsers: false }]);
  assert.deepEqual(applyCalls, [{ companyId: 11, templateId: 110 }]);
  assert.equal(rows[0].status, "Created");
  assert.match(rows[0].message, /2 users refreshed/);
});

test("one template save failure does not contaminate another company", async () => {
  const { bulk, saveCalls } = harness({ failSaveCompanyId: 11 });
  const multi = source(
    "ABC001,purchase_template,Monthly PPE,,,,,",
    "ABC001,purchase_rule,Monthly PPE,PPE-1,4,30,2026-09-01,",
    "ABC001,template_role,Monthly PPE,,,,,Buyer",
    "XYZ002,purchase_template,Standard Allowance,,,,,",
    "XYZ002,purchase_rule,Standard Allowance,PPE-2,2,14,2026-09-01,",
    "XYZ002,template_role,Standard Allowance,,,,,Buyer",
  );
  const rows = await bulk.applyBulkPurchaseControlsCsv(multi, {
    createMissingTemplates: true,
    applyPurchaseTemplates: false,
  });

  assert.equal(saveCalls.length, 2);
  assert.equal(rows.find((row) => row.company_ref === "ABC001").status, "Error");
  assert.match(rows.find((row) => row.company_ref === "ABC001").message, /Template save rejected/);
  assert.equal(rows.find((row) => row.company_ref === "XYZ002").status, "Created");
});

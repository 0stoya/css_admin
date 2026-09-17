import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const csv = load(root, "lib/csv.ts");

const HEADERS = "company_ref,record_type,template_name,sku,quantity_limit,duration_days,start_date,role_name";

function bundle(companyId, templates = []) {
  return {
    format: "fluid-company-controls",
    schema_version: 2,
    company_id: companyId,
    company_catalog: {
      allow_public_catalog: false,
      category_restriction: false,
      allowed_category_ids: [],
      product_restriction: false,
      allowed_product_skus: [],
    },
    role_controls: [{
      role_name: "Buyer",
      sort_order: 10,
      allowed_resources: ["Magento_Sales::place_order"],
      selected_category_ids: [],
      preselect_all_products: true,
      allowed_product_skus: [],
    }],
    purchase_controls: { templates },
  };
}

function template(name, sku = "PPE-1", roles = ["Buyer"]) {
  return {
    name,
    rules: [{ sku, quantity_limit: 4, duration_days: 30, start_date: "2026-09-01" }],
    assigned_role_names: roles,
  };
}

function source(...rows) {
  return [HEADERS, ...rows].join("\n");
}

function harness({ companies, bundles, onImport }) {
  const calls = [];
  const controls = {
    getCompanyControlsBundle: async (companyId) => structuredClone(bundles.get(companyId)),
    importCompanyControls: async (input) => {
      calls.push(structuredClone(input));
      if (onImport) return onImport(input, calls.length);
      return {
        valid: true,
        applied: !input.dry_run,
        purchase_template_users_applied: input.apply_purchase_templates ? 2 : 0,
      };
    },
  };
  const bulk = load(root, "lib/bulk-purchase-controls.ts", {
    "@/lib/csv": csv,
    "@/lib/graphql/companies": { getAllCompanies: async () => companies },
    "@/lib/graphql/company-controls": controls,
  });
  return { bulk, calls };
}

const companies = [
  { company_id: 11, reference: "ABC001", name: "Alpha", sales_representative_id: null, parent_company_id: null },
  { company_id: 22, reference: "XYZ002", name: "Beta", sales_representative_id: null, parent_company_id: null },
];

function twoCompanySource() {
  return source(
    "ABC001,purchase_template,Monthly PPE,,,,,",
    "ABC001,purchase_rule,Monthly PPE,PPE-1,4,30,2026-09-01,",
    "ABC001,template_role,Monthly PPE,,,,,Buyer",
    "XYZ002,purchase_template,Standard Allowance,,,,,",
    "XYZ002,purchase_rule,Standard Allowance,PPE-2,2,14,2026-09-01,",
    "XYZ002,template_role,Standard Allowance,,,,,Buyer",
  );
}

test("preview groups the CSV by company and dry-runs only imported purchase templates", async () => {
  const bundles = new Map([
    [11, bundle(11, [template("Existing unrelated", "OTHER-1")])],
    [22, bundle(22)],
  ]);
  const { bulk, calls } = harness({ companies, bundles });
  const rows = await bulk.previewBulkPurchaseControlsCsv(twoCompanySource(), {
    createMissingTemplates: true,
    applyPurchaseTemplates: false,
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows, (row) => row.company_ref), ["ABC001", "XYZ002"]);
  assert.deepEqual(Array.from(rows, (row) => row.status), ["Created", "Created"]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.dry_run === true));
  assert.deepEqual(calls.map((call) => call.company_id), [11, 22]);
  assert.deepEqual(calls[0].purchase_controls.templates.map((item) => item.name), ["Monthly PPE"]);
  assert.deepEqual(calls[0].role_controls, bundles.get(11).role_controls);
  assert.deepEqual(calls[0].company_catalog, bundles.get(11).company_catalog);
});

test("missing templates are blocked unless the admin explicitly enables creation", async () => {
  const bundles = new Map([[11, bundle(11)]]);
  const { bulk, calls } = harness({ companies: [companies[0]], bundles });
  const rows = await bulk.previewBulkPurchaseControlsCsv(source(
    "ABC001,purchase_template,Monthly PPE,,,,,",
    "ABC001,purchase_rule,Monthly PPE,PPE-1,4,30,2026-09-01,",
  ), {
    createMissingTemplates: false,
    applyPurchaseTemplates: false,
  });

  assert.equal(rows[0].status, "Error");
  assert.match(rows[0].message, /Create missing templates/);
  assert.equal(calls.length, 0);
});

test("unknown company references remain preview errors and never reach Fluid", async () => {
  const { bulk, calls } = harness({ companies: [], bundles: new Map() });
  const rows = await bulk.previewBulkPurchaseControlsCsv(source(
    "MISSING,purchase_template,Monthly PPE,,,,,",
  ), {
    createMissingTemplates: true,
    applyPurchaseTemplates: false,
  });

  assert.equal(rows[0].status, "Error");
  assert.match(rows[0].message, /not found or is ambiguous/);
  assert.equal(calls.length, 0);
});

test("one company apply failure does not stop later companies and is retryable by company_ref", async () => {
  const bundles = new Map([
    [11, bundle(11)],
    [22, bundle(22)],
  ]);
  let failBetaApply = true;
  const { bulk, calls } = harness({
    companies,
    bundles,
    onImport: async (input) => {
      if (input.company_id === 22 && !input.dry_run && failBetaApply) {
        throw new Error("Beta backend failure");
      }
      return {
        valid: true,
        applied: !input.dry_run,
        purchase_template_users_applied: input.apply_purchase_templates ? 3 : 0,
      };
    },
  });

  const first = await bulk.applyBulkPurchaseControlsCsv(twoCompanySource(), {
    createMissingTemplates: true,
    applyPurchaseTemplates: true,
  });
  assert.equal(first.find((row) => row.company_ref === "ABC001").status, "Created");
  assert.equal(first.find((row) => row.company_ref === "XYZ002").status, "Error");
  // The application module runs in a VM realm; a host-realm mocked Error is not
  // instanceof the VM realm's Error, so the defensive fallback text is expected.
  assert.match(first.find((row) => row.company_ref === "XYZ002").message, /Fluid rejected the import/);
  assert.equal(calls.filter((call) => call.company_id === 11).length, 2);
  assert.equal(calls.filter((call) => call.company_id === 22).length, 2);
  assert.ok(calls.every((call) => call.apply_purchase_templates === true));

  failBetaApply = false;
  calls.length = 0;
  const retry = await bulk.applyBulkPurchaseControlsCsv(twoCompanySource(), {
    createMissingTemplates: true,
    applyPurchaseTemplates: true,
    onlyCompanyRefs: ["XYZ002"],
  });
  assert.deepEqual(Array.from(retry, (row) => row.company_ref), ["XYZ002"]);
  assert.equal(retry[0].status, "Created");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.company_id === 22));
});

test("the same company role cannot be assigned to two templates in one file", async () => {
  const bundles = new Map([[11, bundle(11)]]);
  const { bulk, calls } = harness({ companies: [companies[0]], bundles });
  const rows = await bulk.previewBulkPurchaseControlsCsv(source(
    "ABC001,purchase_template,Template A,,,,,",
    "ABC001,template_role,Template A,,,,,Buyer",
    "ABC001,purchase_template,Template B,,,,,",
    "ABC001,template_role,Template B,,,,,Buyer",
  ), {
    createMissingTemplates: true,
    applyPurchaseTemplates: false,
  });

  assert.ok(rows.some((row) => row.status === "Error" && /more than one purchase template/.test(row.message)));
  assert.equal(calls.length, 1);
});

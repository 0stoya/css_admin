import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const csv = load(root, "lib/csv.ts");
const exportsCsv = load(root, "lib/bulk-export-csv.ts", { "./csv": csv });
const plain = value => JSON.parse(JSON.stringify(value));
const company = (company_id, reference, parent_company_id = null) => ({
  company_id, reference, parent_company_id,
  status: true, name: "Company " + reference, sales_representative_id: 35,
});
const basicControls = {
  company_id: 1,
  company_catalog: { product_restriction: true, allowed_product_skus: [] },
  role_controls: [],
  purchase_controls: { templates: [] },
};
const resource = (resource_id, title, parent_resource_id, assignable) =>
  ({ resource_id, title, parent_resource_id, assignable, depth: 0 });
const basicManagement = {
  company_id: 1,
  resources: [resource("Magento_Backend::all", "All", null, false),
    resource("Sales::root", "Sales", "Magento_Backend::all", false),
    resource("Sales::view", "View orders", "Sales::root", true)],
  roles: [{ name: "Buyer", sort_order: 10, allowed_resources: ["Sales::view"], manageable: true }],
  users: [{
    firstname: "John", lastname: "Smith", email: "JOHN@example.com",
    roles: [{ name: "Buyer" }],
  }],
};

function render(kind, companies, getData = () => ({})) {
  const resources = basicManagement.resources;
  const columns = kind === "bulk_roles" ? exportsCsv.rolePermissionColumns(resources) : [];
  let result = "\uFEFF" + exportsCsv.csvRow(exportsCsv.bulkCsvHeader(kind, columns));
  for (const c of companies) {
    for (const row of exportsCsv.bulkCsvRows(kind, c, { columns, ...getData(c) })) {
      result += "\r\n" + exportsCsv.csvRow(row);
    }
  }
  if (exportsCsv.BULK_EXPORTS[kind].trailingNewline) result += "\r\n";
  return result;
}

test("all seven export kinds are allowlisted with the original CSV filenames", () => {
  assert.deepEqual(Object.values(exportsCsv.BULK_EXPORTS).map(x => x.filename), [
    "bulk-company-structure.csv",
    "bulk-company-users.csv",
    "bulk-company-roles.csv",
    "bulk-role-products.csv",
    "bulk-company-products.csv",
    "bulk-company-descriptions.csv",
    "bulk-purchase-controls.csv",
  ]);
  assert.equal(exportsCsv.isBulkExportKind("bulk_purchase_controls"), true);
  assert.equal(exportsCsv.isBulkExportKind("company_structure_products"), false);
  assert.equal(exportsCsv.isBulkExportKind("bulk_unknown"), false);
});

test("company structure and descriptions preserve reference ordering and no final CRLF", () => {
  const sorted = exportsCsv.prepareBulkCompanies("bulk_company_structure", [
    company(2, "Z002", 1), company(1, "A001"),
  ]);
  assert.deepEqual(plain(sorted.map(x => x.company_id)), [1, 2]);
  assert.equal(render("bulk_company_structure", sorted, c => ({
    parentReference: c.parent_company_id === 1 ? "A001" : "",
  })), "\uFEFFcompany_reference,parent_reference\r\nA001,\r\nZ002,A001");

  assert.equal(render("bulk_company_descriptions", [company(1, "A001")], () => ({
    description: 'Hello, "world"\nNext line',
  })), '\uFEFFcompany_ref,company_name,company_description\r\nA001,Company A001,"Hello, ""world""\nNext line"');
  assert.throws(() => exportsCsv.prepareBulkCompanies("bulk_company_structure", [
    company(1, "A001"), company(2, "a001")]), /duplicate/i);
  assert.throws(() => exportsCsv.prepareBulkCompanies("bulk_company_structure", [
    company(2, "Z002", 1)]), /parent/i);
});

test("users and role permissions preserve legacy headers, role flags and final CRLF", () => {
  const c = company(1, "A001");
  assert.equal(render("bulk_users", [c], () => ({ management: basicManagement })),
    "\uFEFFfirst_name,last_name,email,role,company_ref\r\nJohn,Smith,john@example.com,Buyer,A001\r\n");
  assert.equal(render("bulk_roles", [c], () => ({ management: basicManagement })),
    "\uFEFFuser_role,company_ref,sort_order,Sales > View orders\r\nBuyer,A001,10,1\r\n");
  const columns = exportsCsv.rolePermissionColumns(basicManagement.resources);
  assert.throws(() => exportsCsv.assertMatchingRoleColumns(columns, [
    resource("Other::read", "Read", null, true),
  ]), /permission trees differ/i);
});

test("role and company products preserve wildcard, empty allowlist and SKU order", () => {
  const c = company(1, "A001");
  const controls = {
    ...basicControls,
    role_controls: [
      { role_name: "All", preselect_all_products: true, allowed_product_skus: ["HIDDEN"] },
      { role_name: "Buyer", preselect_all_products: false, allowed_product_skus: ["A", "B"] },
      { role_name: "None", preselect_all_products: false, allowed_product_skus: [] },
    ],
    company_catalog: { product_restriction: true, allowed_product_skus: ["B", "A"] },
  };
  assert.equal(render("bulk_role_products", [c], () => ({ controls })),
    "\uFEFFsku,user_role_name,company_ref\r\n*,All,A001\r\nA,Buyer,A001\r\nB,Buyer,A001\r\n,None,A001\r\n");
  assert.equal(render("bulk_company_products", [c], () => ({ controls })),
    "\uFEFFsku,company_ref\r\nB,A001\r\nA,A001\r\n");
  assert.equal(render("bulk_company_products", [c], () => ({ controls: {
    ...controls, company_catalog: { product_restriction: false, allowed_product_skus: [] },
  } })), "\uFEFFsku,company_ref\r\n*,A001\r\n");
});

test("purchase controls preserve legacy template/rule/role ordering and final CRLF", () => {
  const c = company(1, "A001");
  const controls = {
    ...basicControls,
    purchase_controls: { templates: [{
      name: "Monthly PPE",
      rules: [{ sku: "GLOVE-M", quantity_limit: 4, duration_days: 30, start_date: "2026-09-01" }],
      assigned_role_names: ["Buyer"],
    }] },
  };
  assert.equal(render("bulk_purchase_controls", [c], () => ({ controls })),
    "\uFEFFcompany_ref,record_type,template_name,sku,quantity_limit,duration_days,start_date,role_name\r\n" +
    "A001,purchase_template,Monthly PPE,,,,,\r\n" +
    "A001,purchase_rule,Monthly PPE,GLOVE-M,4,30,2026-09-01,\r\n" +
    "A001,template_role,Monthly PPE,,,,,Buyer\r\n");
});

test("queue scope stays limited to initiating Staff identity and owner-only downloads", () => {
  const authSrc = source("lib/admin-job-auth.ts");
  const actions = source("app/(admin)/jobs/actions.ts");
  const db = source("lib/admin-export-jobs.ts");
  const download = source("app/api/admin/jobs/[id]/download/route.ts");
  assert.match(actions, /currentStaffJobIdentity\(\)/);
  assert.match(actions, /prepareBulkCompanies\(kind, visible\)/);
  assert.match(actions, /enqueueBulkExport\(actor.user_id, kind, companies\)/);
  assert.match(db, /string_to_array\(\$\{companyIdsCsv\}, ','\)::integer\[\]/);
  assert.match(db, /pg_advisory_xact_lock/);
  assert.match(download, /getOwnerExportJob\(actor.user_id, id\)/);
  assert.match(download, /ensureJobDownloadScope\(job.root_company_id, job.company_ids, job.export_kind\)/);
  assert.ok(download.indexOf("ensureJobDownloadScope") < download.indexOf("lstat(path)"));
  assert.match(download, /createReadStream\(path\)/);
  assert.match(authSrc, /canDownloadBulkScopedJob/);
});

test("worker writes bounded CSVs and preserves leases, retry rules and privacy", () => {
  const worker = source("worker/export-jobs.ts");
  const bulk = source("worker/bulk-export-csv.ts");
  const migration = source("deploy/postgres/003_bulk_export_jobs.sql");
  assert.match(worker, /isBulkExportKind\(job.export_kind\)/);
  assert.match(worker, /runBulkCsvExport/);
  assert.match(worker, /--check-bulk/);
  assert.match(worker, /migration 003/);
  assert.match(worker, /AdminExportJobCompanyPresentation/);
  assert.match(worker, /AdminExportJobBulkCompanyProducts/);
  assert.match(worker, /AdminExportJobBulkRoleProducts/);
  assert.match(worker, /AdminExportJobBulkPurchaseControls/);
  assert.match(bulk, /await handle.write/);
  assert.match(bulk, /await deps.heartbeat\(index \+ 1\)/);
  assert.match(bulk, /await deps.finish\(name, bytes\)/);
  assert.match(bulk, /await unlink\(path\)/);
  assert.match(bulk, /open\(path, "wx", 0o600\)/);
  assert.match(bulk, /256 \* 1024 \* 1024/);
  assert.doesNotMatch(bulk, /readFile|writeFile|Promise.all\(members/);
  assert.match(migration, /'bulk_purchase_controls'/);
  assert.match(migration, /BETWEEN 1 AND 10000/);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE/);
  const verifier = source("scripts/verify-bulk-export-schema.mjs");
  assert.match(verifier, /BULK EXPORT SCHEMA PASS/);
  assert.doesNotMatch(verifier, /INSERT INTO|UPDATE css_admin|DELETE FROM css_admin|ALTER TABLE/);
});

test("normal Bulk import / export tabs queue all seven kinds", () => {
  const ui = source("components/bulk-import-workspace.tsx");
  assert.match(ui, /action=\{queueBulkExportAction\}/);
  assert.match(ui, /Queue background CSV/);
  assert.equal((ui.match(/exportKind="bulk_/g) ?? []).length, 7);
});

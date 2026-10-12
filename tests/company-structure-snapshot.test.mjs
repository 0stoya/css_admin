import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inflateRawSync, deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const { makeCompanyStructureSnapshotSheets } = load(root, "lib/company-structure-snapshot.ts");
const { createSnapshotXlsx } = load(root, "lib/simple-xlsx.ts", {
  "node:buffer": { Buffer },
  "node:zlib": { deflateRawSync },
});

function company(company_id, reference, parent_company_id = null) {
  return { company_id, reference, name: "Company " + reference, parent_company_id, status: true, sales_representative_id: null };
}
function record(value, restricted) {
  return {
    company: value,
    management: {
      company_id: value.company_id,
      users: [{
        customer_id: 70, user_id: 7, firstname: "Alex", lastname: "Example", email: "alex@example.com",
        is_company_admin: true, manager_user_id: null, approval_type: "none", approval_threshold: null,
        can_checkout: true, can_approve_credit_orders: true, can_auto_approve_credit_order: false,
        roles: [{ role_id: 3, name: "Buyer", manageable: true }],
      }],
      roles: [{
        role_id: 3, name: "Buyer", sort_order: 1, allowed_resources: ["view", "buy"],
        user_count: 1, purchase_employee_count: 0, manageable: true,
      }],
      resources: [],
    },
    controls: {
      company_id: value.company_id, format: "css", schema_version: 2,
      company_catalog: {
        allow_public_catalog: !restricted, category_restriction: restricted,
        allowed_category_ids: restricted ? [] : [7],
        product_restriction: restricted,
        allowed_product_skus: restricted ? [] : ['=HYPERLINK("https://example.invalid")'],
      },
      role_controls: [{
        role_name: "Buyer", sort_order: 1, allowed_resources: ["buy"], selected_category_ids: [12],
        preselect_all_products: !restricted, allowed_product_skus: ["BCR528/03"],
      }],
    },
  };
}
function unpack(data) {
  const parts = new Map();
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const bytes = data.readUInt32LE(offset + 18);
    const nameBytes = data.readUInt16LE(offset + 26);
    const extraBytes = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameBytes).toString();
    const begin = offset + 30 + nameBytes + extraBytes;
    parts.set(name, inflateRawSync(data.subarray(begin, begin + bytes)).toString());
    offset = begin + bytes;
  }
  return parts;
}

test("one product-only sheet per visible company and group summary", () => {
  const head = company(55, "WIL055");
  const sheets = makeCompanyStructureSnapshotSheets(head,
    [record(head, false), record(company(50, "WIL050", 55), true)],
    "2026-10-12T10:00:00Z", "2026-10-12T10:01:00Z");
  assert.deepEqual(Array.from(sheets, item => item.name), ["Summary", "WIL055", "WIL050"]);
  const summary = JSON.stringify(sheets[0].rows);
  assert.match(summary, /not an atomic database snapshot/);
  assert.match(summary, /Restricted — empty product list/);
  assert.match(summary, /No additional product restriction/);
  assert.doesNotMatch(JSON.stringify(sheets), /categor/i);
});

test("company workbook includes users, role memberships and stored product SKUs", () => {
  const head = company(55, "WIL055");
  const rows = makeCompanyStructureSnapshotSheets(head, [record(head, true)], "start", "finish")[1].rows;
  const text = rows.map(item => item.values.join(" | ")).join("\n");
  for (const expected of ["COMPANY USERS", "Alex", "alex@example.com", "ROLE MEMBERSHIPS",
    "COMPANY ROLES", "COMPANY ALLOWED PRODUCT SKUS", "Restricted — empty product list",
    "ROLE PRODUCT SETTINGS", "BCR528/03"]) {
    assert.ok(text.includes(expected), "Missing snapshot field: " + expected);
  }
  assert.doesNotMatch(text, /categor/i);
});

test("missing role product controls are never described as unrestricted", () => {
  const head = company(55, "WIL055");
  const data = record(head, false);
  data.controls.role_controls = [];
  const text = JSON.stringify(makeCompanyStructureSnapshotSheets(head, [data], "start", "finish"));
  assert.match(text, /Not returned by controls export/);
  assert.match(text, /Cannot infer a product restriction/);
});

test("XLSX ZIP has valid parts, and formula-looking SKU is stored as inert text", () => {
  const head = company(55, "WIL055");
  const workbook = createSnapshotXlsx(makeCompanyStructureSnapshotSheets(head, [record(head, false)], "start", "finish"));
  const parts = unpack(workbook);
  assert.ok(parts.has("[Content_Types].xml"));
  assert.ok(parts.has("xl/styles.xml"));
  assert.match(parts.get("xl/workbook.xml"), /name="Summary"/);
  const xml = parts.get("xl/worksheets/sheet2.xml");
  assert.match(xml, /HYPERLINK/);
  assert.match(xml, /t="inlineStr"/);
  assert.doesNotMatch(xml, /<f>/);
  assert.match(xml, /<mergeCell ref="A1:J1"/);
});

test("bad company IDs and oversized XLSX fail closed", () => {
  const head = company(55, "WIL055");
  const data = record(head, false);
  data.management.company_id = 999;
  assert.throws(() => makeCompanyStructureSnapshotSheets(head, [data], "start", "finish"), /mismatched snapshot data/);
  assert.throws(
    () => createSnapshotXlsx([{ name: "large", rows: new Array(250_001).fill({ values: ["sku"] }) }]),
    /row safety limit/,
  );
});

test("snapshot route uses authenticated, bounded read-only GraphQL and never exports partial results", () => {
  const route = source("app/api/companies/[id]/exports/structure-snapshot/route.ts");
  const overview = source("app/(admin)/companies/[id]/page.tsx");
  const imports = source("app/(admin)/companies/[id]/import-export/page.tsx");
  for (const value of ["getAdminToken()", "getAllCompanies()", "findCompanyStructureContext",
    "flattenCompanyStructure", "getCompanyManagement", "getCompanyControlsBundle",
    "MAX_GROUP_COMPANIES", "CONCURRENCY = 2", "private, no-store", "Uint8Array.from(workbook)"]) {
    assert.ok(route.includes(value), "Missing safety boundary: " + value);
  }
  assert.doesNotMatch(route, /cssSelectCompany|updateCompany|saveCompany|importCompanyControls/);
  assert.match(route, /No partial workbook was produced/);
  assert.match(overview, /exports\/structure-snapshot/);
  assert.match(imports, /exports\/structure-snapshot/);
});

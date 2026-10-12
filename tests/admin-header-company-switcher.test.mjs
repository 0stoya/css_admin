import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const { buildCompanyStructure, getCompanyStructureSwitchOptions } = load(root, "lib/company-structure.ts");

function company(company_id, reference, parent_company_id = null, status = true) {
  return { company_id, reference, parent_company_id, name: reference, status, sales_representative_id: null };
}

const companySet = [
  company(55, "WIL055"),
  company(50, "WIL050", 55),
  company(54, "WIL054", 55),
  company(56, "WIL056", 55),
  company(57, "WIL057", 55),
  company(58, "WIL058", 55, false),
  company(70, "OTHER"),
  company(71, "OTHER-C", 70),
  company(90, "SOLO"),
  company(100, "ORPHAN", 999),
];
const structure = buildCompanyStructure(companySet);
const ids = (id) => Array.from(getCompanyStructureSwitchOptions(structure, id), (entry) => entry.company_id);

test("group head and every child can switch within the same visible structure", () => {
  for (const id of [55, 50, 54, 56, 57, 58]) {
    assert.deepEqual(ids(id), [55, 50, 54, 56, 57, 58]);
  }
});

test("unrelated groups and independent companies are never mixed", () => {
  assert.deepEqual(ids(71), [70, 71]);
  assert.deepEqual(ids(90), []);
  assert.deepEqual(ids(100), []);
  assert.deepEqual(ids(999), []);
});

test("a partially visible hierarchy cannot leak an unseen parent or sibling", () => {
  const restricted = buildCompanyStructure([company(50, "WIL050", 55)]);
  assert.deepEqual(Array.from(getCompanyStructureSwitchOptions(restricted, 50)), []);
});

test("disabled members remain identifiable and available to Staff Admin", () => {
  const member = getCompanyStructureSwitchOptions(structure, 50).find((entry) => entry.company_id === 58);
  assert.equal(member?.status, false);
});

test("the company-specific layout loads only the authorised company listing and fails closed", () => {
  const layout = source("app/(admin)/companies/[id]/layout.tsx");
  assert.match(layout, /getAllCompanies\(\)\.catch\(\(\) => null\)/);
  assert.match(layout, /getCompanyStructureSwitchOptions\(/);
  assert.match(layout, /buildCompanyStructure\(visibleCompanies\)/);
  assert.match(layout, /switchableCompanies=\{switchableCompanies\}/);
  assert.doesNotMatch(layout, /cssSelectCompany|customer_token/);
});

test("Staff header switches by safe company ID without modifying Portal sessions", () => {
  const header = source("components/app-header.tsx");
  const switcher = source("components/admin-header-company-switcher.tsx");
  assert.match(header, /company\.switchableCompanies\.length > 1/);
  assert.match(header, /<AdminHeaderCompanySwitcher/);
  assert.match(switcher, /aria-label="Switch company within structure"/);
  assert.match(switcher, /companies\.some\(\(company\) => company\.companyId === nextId\)/);
  assert.match(switcher, /router\.push\(`\/companies\/\$\{nextId\}`\)/);
  assert.doesNotMatch(switcher, /cssSelectCompany|selectPortalCompanyAction/);
});

test("company listing and company detail are memoised per request, never globally", () => {
  const gql = source("lib/graphql/companies.ts");
  assert.match(gql, /import \{ cache \} from "react"/);
  assert.match(gql, /getAllCompanies = cache\(/);
  assert.match(gql, /getCompany = cache\(/);
  assert.doesNotMatch(gql, /unstable_cache|force-cache/);
});

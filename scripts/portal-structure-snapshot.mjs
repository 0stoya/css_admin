#!/usr/bin/env node

/* global process, console, fetch */

import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";

const SNAPSHOT_KIND = "temporary-portal-company-structure-snapshot-v1";

for (const envFile of [".env.local", ".env.production"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
    break;
  }
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const companyRef = argument("--company-ref")?.trim() ?? "";
const output = argument("--output")?.trim() ?? "";
const expiresAt = argument("--expires")?.trim() ?? "";
const allowGroupFinance = hasFlag("--allow-group-finance");
const token = process.env.CSS_ADMIN_SNAPSHOT_ADMIN_TOKEN?.trim() ?? "";

if (!companyRef) fail("Missing --company-ref <reference>.");
if (!output) fail("Missing --output <path>.");
if (!expiresAt || !Number.isFinite(Date.parse(expiresAt))) {
  fail("Missing or invalid --expires <ISO timestamp>.");
}
if (!token) {
  fail("Set CSS_ADMIN_SNAPSHOT_ADMIN_TOKEN to a short-lived Magento Admin token for this one-off export.");
}

const generatedAt = new Date();
const expiry = new Date(expiresAt);
const maxLifetime = 14 * 24 * 60 * 60 * 1000;
if (expiry.getTime() <= generatedAt.getTime()) fail("--expires must be in the future.");
if (expiry.getTime() - generatedAt.getTime() > maxLifetime) {
  fail("Snapshot expiry must be no more than 14 days from generation.");
}

const baseUrl = process.env.MAGENTO_BASE_URL?.replace(/\/$/, "") ?? "";
const graphqlUrl = process.env.MAGENTO_GRAPHQL_URL?.trim()
  || (baseUrl ? `${baseUrl}/graphql` : "");
const storeCode = process.env.MAGENTO_STORE_CODE?.trim() || "default";

if (!graphqlUrl) fail("MAGENTO_GRAPHQL_URL or MAGENTO_BASE_URL must be configured.");

const query = `
  query AdminCompanyList($currentPage: Int!, $pageSize: Int!) {
    css_admin_companies(currentPage: $currentPage, pageSize: $pageSize) {
      total_count
      items {
        company_id
        reference
        status
        name
        sales_representative_id
        parent_company_id
      }
      page_info {
        current_page
        total_pages
      }
    }
  }
`;

async function page(currentPage) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Store: storeCode,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { currentPage, pageSize: 100 },
    }),
  });

  if (!response.ok) {
    fail(`Magento GraphQL returned HTTP ${response.status}.`);
  }

  const body = await response.json();
  if (body.errors?.length) {
    fail(body.errors[0]?.message || "Magento GraphQL returned an error.");
  }

  const result = body.data?.css_admin_companies;
  if (!result) fail("Magento GraphQL returned no company list.");
  return result;
}

const first = await page(1);
const pages = [first];
for (let currentPage = 2; currentPage <= first.page_info.total_pages; currentPage += 1) {
  pages.push(await page(currentPage));
}

const companies = pages.flatMap((result) => result.items);
const target = companies.find(
  (company) => String(company.reference ?? "").trim().toUpperCase() === companyRef.toUpperCase(),
);

if (!target) fail(`Company reference ${companyRef} was not found in the Admin-visible company set.`);

const byId = new Map(companies.map((company) => [company.company_id, company]));
const visited = new Set();
let root = target;

while (root.parent_company_id !== null) {
  if (visited.has(root.company_id)) fail("Circular company hierarchy detected while finding the group root.");
  visited.add(root.company_id);

  const parent = byId.get(root.parent_company_id);
  if (!parent) {
    fail(`Parent company ${root.parent_company_id} is outside the Admin-visible company set.`);
  }
  root = parent;
}

const childrenByParent = new Map();
for (const company of companies) {
  if (company.parent_company_id === null) continue;
  const children = childrenByParent.get(company.parent_company_id) ?? [];
  children.push(company);
  childrenByParent.set(company.parent_company_id, children);
}

const structure = [];
const structureIds = new Set();

function visit(company) {
  if (structureIds.has(company.company_id)) fail("Circular company hierarchy detected while building the snapshot.");
  structureIds.add(company.company_id);
  structure.push(company);

  for (const child of childrenByParent.get(company.company_id) ?? []) {
    visit(child);
  }
}

visit(root);

if (allowGroupFinance && target.company_id !== root.company_id) {
  fail("--allow-group-finance may only be used when --company-ref identifies the canonical group head.");
}

const snapshot = {
  kind: SNAPSHOT_KIND,
  generated_at: generatedAt.toISOString(),
  expires_at: expiry.toISOString(),
  group_finance_company_ids: allowGroupFinance && structure.length > 1
    ? [root.company_id]
    : [],
  companies: structure,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
await chmod(output, 0o600);

console.log(
  `Wrote ${structure.length} company record${structure.length === 1 ? "" : "s"} for `
  + `${root.reference || root.name} to ${output}.`,
);
console.log(
  snapshot.group_finance_company_ids.length
    ? "Temporary group-head finance aggregation: ENABLED."
    : "Temporary group-head finance aggregation: disabled.",
);

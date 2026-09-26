import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("finance migration keeps snapshots and presentation settings local", () => {
  const sql = source("deploy/postgres/001_company_finance_snapshots.sql");
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS css_admin/);
  assert.match(sql, /company_order_finance_snapshot/);
  assert.match(sql, /UNIQUE \(company_id, source_refreshed_at\)/);
  assert.match(sql, /company_finance_visibility/);
  assert.match(sql, /show_last_365_days boolean NOT NULL DEFAULT true/);
});

test("local finance store is resilient and snapshot-first", () => {
  const store = source("lib/company-finance-local.ts");
  assert.match(store, /getLatestCompanyFinanceSnapshot\(companyId\)/);
  assert.match(store, /saveCompanyFinanceSnapshot\(live\)/);
  assert.match(store, /source: "local"/);
  assert.match(store, /source: "live"/);
  assert.match(store, /ON CONFLICT \(company_id, source_refreshed_at\)/);
});

test("rolling 365 days probes new backend field but retains legacy compatibility", () => {
  const graphql = source("lib/graphql/company-finance.ts");
  assert.match(graphql, /last_365_days/);
  assert.match(graphql, /LEGACY_COMPANY_FINANCIAL_SUMMARY_QUERY/);
  assert.match(graphql, /rolling365Supported/);
  assert.match(graphql, /Cannot query field/);
});

test("company settings expose finance period visibility controls", () => {
  const page = source("app/(admin)/companies/[id]/settings/page.tsx");
  const actions = source("app/(admin)/companies/[id]/settings/actions.ts");
  for (const field of [
    "showYearToDate",
    "showLast7Days",
    "showLast30Days",
    "showLast3Months",
    "showLast6Months",
    "showLast365Days",
  ]) {
    assert.match(page, new RegExp(field));
  }
  assert.match(actions, /updateCompanyFinanceVisibilityAction/);
  assert.match(actions, /saveCompanyFinanceVisibility/);
});

test("group heads can display and refresh descendant finance snapshots", () => {
  const finance = source("app/(admin)/companies/[id]/finance/page.tsx");
  const actions = source("app/(admin)/companies/[id]/finance/actions.ts");
  const structure = source("lib/company-structure.ts");

  assert.match(finance, /Group finance snapshot/);
  assert.match(finance, /All synced companies/);
  assert.match(finance, /getLatestCompanyFinanceSnapshots/);
  assert.match(actions, /refreshCompanyGroupFinanceAction/);
  assert.match(actions, /batchSize = 5/);
  assert.match(structure, /flattenCompanyStructure/);
});

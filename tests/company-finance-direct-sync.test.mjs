import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  aggregateOglFinance,
  extractOglCustomers,
  financeHistoryDays,
  getDirectOglFinanceConfig,
  oglRequest,
} from "../scripts/finance-sync-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("direct OGL customer discovery deduplicates CREFs", () => {
  const customers = extractOglCustomers([
    { id: "BIO001", attributes: { cref: "BIO001", fullname: "Bio One", stopped: false } },
    { id: "ignored", attributes: { cref: "bio001", fullname: "Duplicate" } },
    { id: "BIO002", attributes: { fullname: "Bio Two", stopped: true } },
    { id: "", attributes: {} },
  ]);

  assert.deepEqual(customers, [
    { cref: "BIO001", name: "Bio One", stopped: false },
    { cref: "BIO002", name: "Bio Two", stopped: true },
  ]);
});

test("direct OGL finance matches Fluid period semantics and adds rolling 365", () => {
  const now = new Date("2026-09-26T08:00:00.000Z");
  const rows = [
    { attributes: { ordno: "1", orddate: "2026-09-26", value: "100.00" } },
    { attributes: { ordno: "2", orddate: "2026-09-20", value: "20.00" } },
    { attributes: { ordno: "3", orddate: "2026-08-30", value: "30.00" } },
    { attributes: { ordno: "4", orddate: "2026-06-26", value: "40.00" } },
    { attributes: { ordno: "5", orddate: "2026-03-26", value: "50.00" } },
    { attributes: { ordno: "6", orddate: "2025-09-27", value: "60.00" } },
    { attributes: { ordno: "7", orddate: "2025-09-26", value: "70.00" } },
    { attributes: { ordno: "future", orddate: "2026-09-27", value: "999.00" } },
  ];

  const result = aggregateOglFinance("BIO001", rows, { now, currency: "GBP" });

  assert.deepEqual(result.year_to_date, { order_count: 5, value: 240 });
  assert.deepEqual(result.last_7_days, { order_count: 2, value: 120 });
  assert.deepEqual(result.last_30_days, { order_count: 3, value: 150 });
  assert.deepEqual(result.last_3_months, { order_count: 4, value: 190 });
  assert.deepEqual(result.last_6_months, { order_count: 5, value: 240 });
  assert.deepEqual(result.last_365_days, { order_count: 6, value: 300 });
  assert.equal(result.last_order_date, "2026-09-26");
  assert.equal(result.monthly[2].value, 50);
  assert.equal(result.monthly[5].value, 40);
  assert.equal(result.monthly[7].value, 30);
  assert.equal(result.monthly[8].value, 120);
  assert.equal(result.source_kind, "OGL_DIRECT");
});

test("missing OGL order history is treated as an empty finance period", async () => {
  const config = {
    apiUrl: "https://ogl.example.test",
    apiKey: "secret",
    timeoutMs: 5_000,
  };
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    text: async () => JSON.stringify({ errors: [{ detail: "No orders" }] }),
  });

  const rows = await oglRequest(
    "customer/BIO999/orders/365",
    config,
    fetchImpl,
    { notFoundAsEmpty: true },
  );

  assert.deepEqual(rows, []);
});

test("direct OGL sync always requests enough history for YTD and 365 days", () => {
  assert.equal(financeHistoryDays(new Date("2026-09-26T12:00:00Z")), 365);
  assert.equal(financeHistoryDays(new Date("2028-12-31T12:00:00Z")), 366);
});

test("direct OGL config is server-only and bounded", () => {
  const config = getDirectOglFinanceConfig({
    CSS_ADMIN_OGL_API_URL: "https://ogl.example.test/",
    CSS_ADMIN_OGL_API_KEY: "secret",
    CSS_ADMIN_FINANCE_CURRENCY: "gbp",
    CSS_ADMIN_FINANCE_SYNC_CONCURRENCY: "50",
    CSS_ADMIN_FINANCE_SYNC_TIMEOUT_MS: "500",
  });

  assert.equal(config.apiUrl, "https://ogl.example.test");
  assert.equal(config.apiKey, "secret");
  assert.equal(config.currency, "GBP");
  assert.equal(config.concurrency, 5);
  assert.equal(config.timeoutMs, 25_000);
});

test("finance sync runner keeps its node shebang as the first line", () => {
  const runner = source("scripts/finance-sync.mjs");
  assert.ok(runner.startsWith("#!/usr/bin/env node\n"));
});

test("CREF snapshots and systemd timer are part of the deployment contract", () => {
  const migration = source("deploy/postgres/002_direct_ogl_finance_sync.sql");
  const service = source("deploy/systemd/css-admin-finance-sync.service");
  const timer = source("deploy/systemd/css-admin-finance-sync.timer");
  const localStore = source("lib/company-finance-local.ts");

  assert.match(migration, /ALTER COLUMN company_id DROP NOT NULL/);
  assert.match(migration, /UNIQUE \(cref, source_refreshed_at\)/);
  assert.match(migration, /company_finance_sync_run/);
  assert.match(service, /scripts\/finance-sync\.mjs/);
  assert.match(service, /EnvironmentFile=\/etc\/css-admin-finance-sync\.env/);
  assert.match(timer, /OnCalendar=\*-\*-\* 00,04,08,12,16,20:00:00/);
  assert.match(timer, /Persistent=true/);
  assert.match(localStore, /getLatestCompanyFinanceSnapshotsForCompanies/);
  assert.match(localStore, /UPPER\(cref\)/);
});

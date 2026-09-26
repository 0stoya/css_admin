/* global process, fetch, AbortSignal */

import postgres from "postgres";

const DAY_MS = 24 * 60 * 60 * 1000;

function requiredEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function getDirectOglFinanceConfig(env = process.env) {
  return {
    apiUrl: requiredEnv("CSS_ADMIN_OGL_API_URL", env).replace(/\/+$/, ""),
    apiKey: requiredEnv("CSS_ADMIN_OGL_API_KEY", env),
    currency: (env.CSS_ADMIN_FINANCE_CURRENCY?.trim() || "GBP").toUpperCase(),
    concurrency: boundedInt(env.CSS_ADMIN_FINANCE_SYNC_CONCURRENCY, 5, 1, 20),
    timeoutMs: boundedInt(env.CSS_ADMIN_FINANCE_SYNC_TIMEOUT_MS, 25_000, 1_000, 120_000),
  };
}

function endpointUrl(baseUrl, path) {
  return `${baseUrl}/${String(path).replace(/^\/+|\/+$/g, "")}/`;
}

export async function oglRequest(
  path,
  config,
  fetchImpl = fetch,
  { notFoundAsEmpty = false } = {},
) {
  const response = await fetchImpl(endpointUrl(config.apiUrl, path), {
    method: "GET",
    headers: {
      Authorization: `PLAIN ${config.apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`OGL returned invalid JSON for ${path} (HTTP ${response.status}).`);
  }

  if (response.status === 404 && notFoundAsEmpty) {
    return [];
  }

  if (!response.ok) {
    const detail = Array.isArray(body?.errors) && body.errors.length
      ? JSON.stringify(body.errors[0])
      : response.statusText || "request failed";
    throw new Error(`OGL ${path} returned HTTP ${response.status}: ${detail}`);
  }

  if (Array.isArray(body?.errors) && body.errors.length && !Array.isArray(body?.data)) {
    throw new Error(`OGL ${path} returned API errors: ${JSON.stringify(body.errors[0])}`);
  }

  return Array.isArray(body?.data) ? body.data : [];
}

function attributes(row) {
  if (!row || typeof row !== "object") return {};
  const nested = row.attributes;
  return nested && typeof nested === "object" ? nested : row;
}

export function extractOglCustomers(rows) {
  const seen = new Set();
  const customers = [];

  for (const row of rows) {
    const attrs = attributes(row);
    const cref = String(attrs.cref ?? row?.id ?? "").trim();
    if (!cref) continue;

    const key = cref.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    customers.push({
      cref,
      name: String(attrs.fullname ?? attrs.name ?? "").trim() || null,
      stopped: Boolean(attrs.stopped),
    });
  }

  return customers;
}

function utcDay(value = new Date()) {
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  ));
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function subtractUtcMonths(date, months) {
  const copy = new Date(date.getTime());
  copy.setUTCMonth(copy.getUTCMonth() - months);
  return utcDay(copy);
}

function parseOglDate(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(result.getTime()) ? null : result;
  }

  match = /^(\d{2})[\/-](\d{2})[\/-](\d{4})/.exec(text);
  if (match) {
    const result = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : utcDay(parsed);
}

function blankPeriod() {
  return { order_count: 0, value: 0 };
}

function addToPeriod(period, value) {
  period.order_count += 1;
  period.value += value;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finishPeriod(period) {
  return {
    order_count: period.order_count,
    value: roundMoney(period.value),
  };
}

function formatIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

export function financeHistoryDays(now = new Date()) {
  const today = utcDay(now);
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const ytdDays = Math.floor((today.getTime() - yearStart.getTime()) / DAY_MS) + 1;
  return Math.max(365, ytdDays);
}

export function aggregateOglFinance(cref, rows, {
  now = new Date(),
  currency = "GBP",
} = {}) {
  const today = utcDay(now);
  const year = today.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const last7Start = addUtcDays(today, -6);
  const last30Start = addUtcDays(today, -29);
  const last3MonthsStart = subtractUtcMonths(today, 3);
  const last6MonthsStart = subtractUtcMonths(today, 6);
  const last365Start = addUtcDays(today, -364);

  const yearToDate = blankPeriod();
  const last7Days = blankPeriod();
  const last30Days = blankPeriod();
  const last3Months = blankPeriod();
  const last6Months = blankPeriod();
  const last365Days = blankPeriod();

  const monthly = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    order_count: 0,
    value: 0,
  }));

  const ordersByNumber = new Map();
  for (const row of rows) {
    const attrs = attributes(row);
    const orderNumber = String(attrs.ordno ?? row?.id ?? "").trim();
    if (!orderNumber) continue;
    ordersByNumber.set(orderNumber, attrs);
  }

  let lastOrderDate = null;

  for (const attrs of ordersByNumber.values()) {
    const orderDate = parseOglDate(attrs.orddate);
    if (!orderDate || orderDate > today) continue;

    const rawValue = Number(attrs.value ?? 0);
    const value = Number.isFinite(rawValue) ? rawValue : 0;

    if (!lastOrderDate || orderDate > lastOrderDate) lastOrderDate = orderDate;
    if (orderDate >= last7Start) addToPeriod(last7Days, value);
    if (orderDate >= last30Start) addToPeriod(last30Days, value);
    if (orderDate >= last3MonthsStart) addToPeriod(last3Months, value);
    if (orderDate >= last6MonthsStart) addToPeriod(last6Months, value);
    if (orderDate >= last365Start) addToPeriod(last365Days, value);

    if (orderDate >= yearStart) {
      addToPeriod(yearToDate, value);
      const month = orderDate.getUTCMonth();
      monthly[month].order_count += 1;
      monthly[month].value += value;
    }
  }

  return {
    company_id: null,
    cref,
    currency,
    year,
    year_to_date: finishPeriod(yearToDate),
    last_7_days: finishPeriod(last7Days),
    last_30_days: finishPeriod(last30Days),
    last_3_months: finishPeriod(last3Months),
    last_6_months: finishPeriod(last6Months),
    last_365_days: finishPeriod(last365Days),
    monthly: monthly.map((month) => ({
      ...month,
      value: roundMoney(month.value),
    })),
    last_order_date: lastOrderDate ? formatIsoDay(lastOrderDate) : null,
    refreshed_at: now.toISOString(),
    source_kind: "OGL_DIRECT",
  };
}

export async function fetchDirectOglFinance(cref, config, fetchImpl = fetch, now = new Date()) {
  const days = financeHistoryDays(now);
  const rows = await oglRequest(
    `customer/${encodeURIComponent(cref)}/orders/${days}`,
    config,
    fetchImpl,
    { notFoundAsEmpty: true },
  );
  return aggregateOglFinance(cref, rows, { now, currency: config.currency });
}

export function openFinanceDatabase(connectionString = process.env.CSS_ADMIN_DATABASE_URL) {
  const value = connectionString?.trim();
  if (!value) throw new Error("CSS_ADMIN_DATABASE_URL is not configured.");
  return postgres(value, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

export async function saveDirectOglFinanceSnapshot(sql, summary) {
  await sql`
    INSERT INTO css_admin.company_order_finance_snapshot (
      company_id,
      cref,
      currency,
      financial_year,
      year_to_date_order_count,
      year_to_date_value,
      last_7_days_order_count,
      last_7_days_value,
      last_30_days_order_count,
      last_30_days_value,
      last_3_months_order_count,
      last_3_months_value,
      last_6_months_order_count,
      last_6_months_value,
      last_365_days_order_count,
      last_365_days_value,
      monthly,
      last_order_date,
      source_refreshed_at,
      captured_at,
      source_kind
    ) VALUES (
      ${null},
      ${summary.cref},
      ${summary.currency},
      ${summary.year},
      ${summary.year_to_date.order_count},
      ${summary.year_to_date.value},
      ${summary.last_7_days.order_count},
      ${summary.last_7_days.value},
      ${summary.last_30_days.order_count},
      ${summary.last_30_days.value},
      ${summary.last_3_months.order_count},
      ${summary.last_3_months.value},
      ${summary.last_6_months.order_count},
      ${summary.last_6_months.value},
      ${summary.last_365_days.order_count},
      ${summary.last_365_days.value},
      ${sql.json(summary.monthly)},
      ${summary.last_order_date},
      ${summary.refreshed_at},
      now(),
      'OGL_DIRECT'
    )
    ON CONFLICT (cref, source_refreshed_at) DO UPDATE SET
      currency = EXCLUDED.currency,
      financial_year = EXCLUDED.financial_year,
      year_to_date_order_count = EXCLUDED.year_to_date_order_count,
      year_to_date_value = EXCLUDED.year_to_date_value,
      last_7_days_order_count = EXCLUDED.last_7_days_order_count,
      last_7_days_value = EXCLUDED.last_7_days_value,
      last_30_days_order_count = EXCLUDED.last_30_days_order_count,
      last_30_days_value = EXCLUDED.last_30_days_value,
      last_3_months_order_count = EXCLUDED.last_3_months_order_count,
      last_3_months_value = EXCLUDED.last_3_months_value,
      last_6_months_order_count = EXCLUDED.last_6_months_order_count,
      last_6_months_value = EXCLUDED.last_6_months_value,
      last_365_days_order_count = EXCLUDED.last_365_days_order_count,
      last_365_days_value = EXCLUDED.last_365_days_value,
      monthly = EXCLUDED.monthly,
      last_order_date = EXCLUDED.last_order_date,
      captured_at = now(),
      source_kind = 'OGL_DIRECT'
  `;
}

export async function startFinanceSyncRun(sql) {
  const rows = await sql`
    INSERT INTO css_admin.company_finance_sync_run DEFAULT VALUES
    RETURNING id
  `;
  return Number(rows[0].id);
}

export async function finishFinanceSyncRun(sql, runId, {
  status,
  customersDiscovered,
  companiesSynced,
  failures,
}) {
  await sql`
    UPDATE css_admin.company_finance_sync_run
    SET
      completed_at = now(),
      status = ${status},
      customers_discovered = ${customersDiscovered},
      companies_synced = ${companiesSynced},
      companies_failed = ${failures.length},
      error_sample = ${sql.json(failures.slice(0, 20))}
    WHERE id = ${runId}
  `;
}

export async function mapWithConcurrency(items, concurrency, work) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      try {
        results[index] = { status: "fulfilled", value: await work(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => worker()),
  );

  return results;
}

import {
  getCompanyFinancialSummary,
  type CompanyFinanceMonth,
  type CompanyFinancePeriod,
  type CompanyFinancialSummary,
} from "@/lib/graphql/company-finance";
import { getLocalPostgres, hasLocalPostgres } from "@/lib/local-postgres";

export type StoredCompanyFinancialSummary = CompanyFinancialSummary & {
  captured_at: string | null;
};

export type CompanyFinanceVisibility = {
  company_id: number;
  show_year_to_date: boolean;
  show_last_7_days: boolean;
  show_last_30_days: boolean;
  show_last_3_months: boolean;
  show_last_6_months: boolean;
  show_last_365_days: boolean;
  updated_at: string | null;
};

type FinanceSnapshotRow = {
  company_id: number;
  cref: string | null;
  currency: string;
  financial_year: number;
  year_to_date_order_count: number;
  year_to_date_value: number | string;
  last_7_days_order_count: number;
  last_7_days_value: number | string;
  last_30_days_order_count: number;
  last_30_days_value: number | string;
  last_3_months_order_count: number;
  last_3_months_value: number | string;
  last_6_months_order_count: number;
  last_6_months_value: number | string;
  last_365_days_order_count: number | null;
  last_365_days_value: number | string | null;
  monthly: unknown;
  last_order_date: Date | string | null;
  source_refreshed_at: Date | string;
  captured_at: Date | string;
};

type FinanceVisibilityRow = {
  company_id: number;
  show_year_to_date: boolean;
  show_last_7_days: boolean;
  show_last_30_days: boolean;
  show_last_3_months: boolean;
  show_last_6_months: boolean;
  show_last_365_days: boolean;
  updated_at: Date | string;
};

export type CompanyFinanceDisplayResult = {
  finance: StoredCompanyFinancialSummary;
  source: "local" | "live";
  persistence_error: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected local finance storage error.";
}

function iso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function amount(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function financePeriod(orderCount: number, value: number | string): CompanyFinancePeriod {
  return {
    order_count: Number(orderCount) || 0,
    value: amount(value) ?? 0,
  };
}

function monthlyRows(value: unknown): CompanyFinanceMonth[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const month = Number(row.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) return null;
      return {
        month,
        order_count: Number(row.order_count) || 0,
        value: Number(row.value) || 0,
      };
    })
    .filter((item): item is CompanyFinanceMonth => item !== null);
}

function snapshotFromRow(row: FinanceSnapshotRow): StoredCompanyFinancialSummary {
  const last365Value = amount(row.last_365_days_value);
  return {
    company_id: Number(row.company_id),
    cref: row.cref,
    currency: row.currency,
    year: Number(row.financial_year),
    year_to_date: financePeriod(row.year_to_date_order_count, row.year_to_date_value),
    last_7_days: financePeriod(row.last_7_days_order_count, row.last_7_days_value),
    last_30_days: financePeriod(row.last_30_days_order_count, row.last_30_days_value),
    last_3_months: financePeriod(row.last_3_months_order_count, row.last_3_months_value),
    last_6_months: financePeriod(row.last_6_months_order_count, row.last_6_months_value),
    last_365_days:
      row.last_365_days_order_count === null || last365Value === null
        ? null
        : {
            order_count: Number(row.last_365_days_order_count) || 0,
            value: last365Value,
          },
    monthly: monthlyRows(row.monthly),
    last_order_date: iso(row.last_order_date),
    refreshed_at: iso(row.source_refreshed_at) ?? "",
    captured_at: iso(row.captured_at),
  };
}

function liveSnapshot(summary: CompanyFinancialSummary): StoredCompanyFinancialSummary {
  return {
    ...summary,
    captured_at: new Date().toISOString(),
  };
}

export function defaultCompanyFinanceVisibility(companyId: number): CompanyFinanceVisibility {
  return {
    company_id: companyId,
    show_year_to_date: true,
    show_last_7_days: true,
    show_last_30_days: true,
    show_last_3_months: true,
    show_last_6_months: true,
    show_last_365_days: true,
    updated_at: null,
  };
}

export function isCompanyFinanceStoreConfigured() {
  return hasLocalPostgres();
}

export async function saveCompanyFinanceSnapshot(summary: CompanyFinancialSummary) {
  const sql = getLocalPostgres();
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
      captured_at
    ) VALUES (
      ${summary.company_id},
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
      ${summary.last_365_days?.order_count ?? null},
      ${summary.last_365_days?.value ?? null},
      ${sql.json(summary.monthly)},
      ${summary.last_order_date},
      ${summary.refreshed_at},
      now()
    )
    ON CONFLICT (company_id, source_refreshed_at) DO UPDATE SET
      cref = EXCLUDED.cref,
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
      captured_at = now()
  `;
}

export async function getLatestCompanyFinanceSnapshot(companyId: number) {
  if (!hasLocalPostgres()) return null;

  const sql = getLocalPostgres();
  const rows = await sql`
    SELECT
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
      captured_at
    FROM css_admin.company_order_finance_snapshot
    WHERE company_id = ${companyId}
    ORDER BY source_refreshed_at DESC, captured_at DESC
    LIMIT 1
  `;

  return rows[0] ? snapshotFromRow(rows[0] as FinanceSnapshotRow) : null;
}

export async function getLatestCompanyFinanceSnapshots(companyIds: number[]) {
  const result = new Map<number, StoredCompanyFinancialSummary>();
  if (!hasLocalPostgres() || companyIds.length === 0) return result;

  const sql = getLocalPostgres();
  const rows = await sql`
    SELECT DISTINCT ON (company_id)
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
      captured_at
    FROM css_admin.company_order_finance_snapshot
    WHERE company_id IN ${sql(companyIds)}
    ORDER BY company_id, source_refreshed_at DESC, captured_at DESC
  `;

  for (const row of rows) {
    const snapshot = snapshotFromRow(row as FinanceSnapshotRow);
    result.set(snapshot.company_id, snapshot);
  }

  return result;
}

export async function getCompanyFinanceVisibility(companyId: number) {
  if (!hasLocalPostgres()) return defaultCompanyFinanceVisibility(companyId);

  const sql = getLocalPostgres();
  const rows = await sql`
    SELECT
      company_id,
      show_year_to_date,
      show_last_7_days,
      show_last_30_days,
      show_last_3_months,
      show_last_6_months,
      show_last_365_days,
      updated_at
    FROM css_admin.company_finance_visibility
    WHERE company_id = ${companyId}
    LIMIT 1
  `;

  if (!rows[0]) return defaultCompanyFinanceVisibility(companyId);
  const row = rows[0] as FinanceVisibilityRow;
  return {
    company_id: Number(row.company_id),
    show_year_to_date: Boolean(row.show_year_to_date),
    show_last_7_days: Boolean(row.show_last_7_days),
    show_last_30_days: Boolean(row.show_last_30_days),
    show_last_3_months: Boolean(row.show_last_3_months),
    show_last_6_months: Boolean(row.show_last_6_months),
    show_last_365_days: Boolean(row.show_last_365_days),
    updated_at: iso(row.updated_at),
  } satisfies CompanyFinanceVisibility;
}

export async function saveCompanyFinanceVisibility(
  visibility: Omit<CompanyFinanceVisibility, "updated_at">,
) {
  const sql = getLocalPostgres();
  await sql`
    INSERT INTO css_admin.company_finance_visibility (
      company_id,
      show_year_to_date,
      show_last_7_days,
      show_last_30_days,
      show_last_3_months,
      show_last_6_months,
      show_last_365_days,
      updated_at
    ) VALUES (
      ${visibility.company_id},
      ${visibility.show_year_to_date},
      ${visibility.show_last_7_days},
      ${visibility.show_last_30_days},
      ${visibility.show_last_3_months},
      ${visibility.show_last_6_months},
      ${visibility.show_last_365_days},
      now()
    )
    ON CONFLICT (company_id) DO UPDATE SET
      show_year_to_date = EXCLUDED.show_year_to_date,
      show_last_7_days = EXCLUDED.show_last_7_days,
      show_last_30_days = EXCLUDED.show_last_30_days,
      show_last_3_months = EXCLUDED.show_last_3_months,
      show_last_6_months = EXCLUDED.show_last_6_months,
      show_last_365_days = EXCLUDED.show_last_365_days,
      updated_at = now()
  `;

  return getCompanyFinanceVisibility(visibility.company_id);
}

export async function getCompanyFinanceForDisplay(
  companyId: number,
): Promise<CompanyFinanceDisplayResult> {
  let persistenceError: string | null = null;

  if (hasLocalPostgres()) {
    try {
      const local = await getLatestCompanyFinanceSnapshot(companyId);
      if (local) {
        return {
          finance: local,
          source: "local",
          persistence_error: null,
        };
      }
    } catch (error) {
      persistenceError = errorMessage(error);
    }
  }

  const live = await getCompanyFinancialSummary(companyId);

  if (hasLocalPostgres()) {
    try {
      await saveCompanyFinanceSnapshot(live);
      const stored = await getLatestCompanyFinanceSnapshot(companyId);
      if (stored) {
        return {
          finance: stored,
          source: "local",
          persistence_error: persistenceError,
        };
      }
    } catch (error) {
      persistenceError = errorMessage(error);
    }
  }

  return {
    finance: liveSnapshot(live),
    source: "live",
    persistence_error: persistenceError,
  };
}

export async function refreshCompanyFinance(companyId: number) {
  const live = await getCompanyFinancialSummary(companyId);
  if (!hasLocalPostgres()) return liveSnapshot(live);

  await saveCompanyFinanceSnapshot(live);
  return (await getLatestCompanyFinanceSnapshot(companyId)) ?? liveSnapshot(live);
}

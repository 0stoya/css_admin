import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildCompanyStructure,
  findCompanyStructureContext,
  flattenCompanyStructure,
  type CompanyStructureNode,
} from "@/lib/company-structure";
import {
  defaultCompanyFinanceVisibility,
  getCompanyFinanceForDisplay,
  getCompanyFinanceVisibility,
  getLatestCompanyFinanceSnapshots,
  type CompanyFinanceVisibility,
  type StoredCompanyFinancialSummary,
} from "@/lib/company-finance-local";
import { getAllCompanies, getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  type CompanyFinanceMonth,
  type CompanyFinancePeriod,
} from "@/lib/graphql/company-finance";
import styles from "@/components/company-finance-workspace.module.css";
import {
  refreshCompanyFinanceAction,
  refreshCompanyGroupFinanceAction,
} from "./actions";

type FinancePeriodKey =
  | "year_to_date"
  | "last_7_days"
  | "last_30_days"
  | "last_3_months"
  | "last_6_months"
  | "last_365_days";

type SearchParams = Promise<{
  notice?: string;
  error?: string;
}>;

function formatAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatCompactAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatAmount(value, currency);
  }
}

function formatDate(value: string | null) {
  if (!value) return "No orders returned";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(2000, month - 1, 1));
}

function periodCard(
  label: string,
  period: CompanyFinancePeriod | null,
  currency: string,
  primary = false,
) {
  return (
    <article className={`${styles.metricCard}${primary ? ` ${styles.metricCardPrimary}` : ""}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>
        {period ? formatAmount(period.value, currency) : "—"}
      </strong>
      <span className={styles.metricMeta}>
        {period
          ? `${period.order_count} order${period.order_count === 1 ? "" : "s"}`
          : "Awaiting source support"}
      </span>
    </article>
  );
}

function normaliseMonths(months: CompanyFinanceMonth[]) {
  const byMonth = new Map(months.map((month) => [month.month, month]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return byMonth.get(month) ?? { month, order_count: 0, value: 0 };
  });
}

function visibilityColumns(visibility: CompanyFinanceVisibility) {
  return [
    { key: "year_to_date" as const, label: "Spend YTD", enabled: visibility.show_year_to_date },
    { key: "last_7_days" as const, label: "7 days", enabled: visibility.show_last_7_days },
    { key: "last_30_days" as const, label: "30 days", enabled: visibility.show_last_30_days },
    { key: "last_3_months" as const, label: "3 months", enabled: visibility.show_last_3_months },
    { key: "last_6_months" as const, label: "6 months", enabled: visibility.show_last_6_months },
    { key: "last_365_days" as const, label: "365 days", enabled: visibility.show_last_365_days },
  ].filter((column) => column.enabled);
}

function aggregatePeriod(
  snapshots: StoredCompanyFinancialSummary[],
  key: FinancePeriodKey,
): CompanyFinancePeriod | null {
  const values = snapshots.map((snapshot) => snapshot[key]);
  if (!values.length || values.some((period) => period === null)) return null;

  const periods = values as CompanyFinancePeriod[];
  return periods.reduce<CompanyFinancePeriod>(
    (total, period) => ({
      order_count: total.order_count + period.order_count,
      value: total.value + period.value,
    }),
    { order_count: 0, value: 0 },
  );
}

function groupPeriodCell(
  period: CompanyFinancePeriod | null,
  currency: string,
  fallback: string,
) {
  if (!period) {
    return (
      <div className="cell-stack">
        <strong>—</strong>
        <span className="muted small-text">{fallback}</span>
      </div>
    );
  }

  return (
    <div className="cell-stack">
      <strong>{formatAmount(period.value, currency)}</strong>
      <span className="muted small-text">
        {period.order_count} order{period.order_count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

async function loadFinance(companyId: number) {
  const [companyResult, financeResult, structureResult, visibilityResult] = await Promise.allSettled([
    getCompany(companyId),
    getCompanyFinanceForDisplay(companyId),
    getAllCompanies(),
    getCompanyFinanceVisibility(companyId),
  ]);

  return {
    company: companyResult.status === "fulfilled" ? companyResult.value : null,
    companyError: companyResult.status === "rejected" ? graphQLErrorMessage(companyResult.reason) : null,
    finance: financeResult.status === "fulfilled" ? financeResult.value : null,
    financeError: financeResult.status === "rejected" ? graphQLErrorMessage(financeResult.reason) : null,
    companies: structureResult.status === "fulfilled" ? structureResult.value : null,
    structureError: structureResult.status === "rejected" ? graphQLErrorMessage(structureResult.reason) : null,
    visibility:
      visibilityResult.status === "fulfilled"
        ? visibilityResult.value
        : defaultCompanyFinanceVisibility(companyId),
    visibilityError:
      visibilityResult.status === "rejected"
        ? graphQLErrorMessage(visibilityResult.reason)
        : null,
  };
}

export default async function CompanyFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const {
    company,
    companyError,
    finance,
    financeError,
    companies,
    structureError,
    visibility,
    visibilityError,
  } = await loadFinance(companyId);

  if (!company) {
    return (
      <div className="stack">
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Company finance unavailable</h1>
          </div>
          <div className="error">{companyError}</div>
        </section>
      </div>
    );
  }

  if (!finance) {
    return (
      <div className={styles.workspace}>
        <header className="page-header">
          <div>
            <p className="eyebrow">{company.reference || `Company ${company.company_id}`}</p>
            <h1>Finance</h1>
            <p className="muted">OGL order activity aggregated by Fluid for {company.name}.</p>
          </div>
        </header>

        <section className={`card ${styles.emptyCard}`}>
          <div>
            <p className="eyebrow">Financial summary</p>
            <h2>Finance data is not available yet</h2>
          </div>
          <p className="muted">
            No usable local snapshot exists and the Fluid GraphQL financial-summary request did not return a result.
          </p>
          {financeError ? (
            <details className={styles.errorDetails}>
              <summary>Technical details</summary>
              <div className="error">{financeError}</div>
            </details>
          ) : null}
        </section>
      </div>
    );
  }

  const summary = finance.finance;
  const months = normaliseMonths(summary.monthly);
  const maxMonthValue = Math.max(1, ...months.map((month) => month.value));
  const columns = visibilityColumns(visibility);

  const roots = companies ? buildCompanyStructure(companies) : null;
  const structureContext = roots
    ? findCompanyStructureContext(roots, company.company_id)
    : null;
  const isGroupHead = Boolean(
    structureContext
    && structureContext.root.company.company_id === company.company_id
    && structureContext.root.company.parent_company_id === null
    && structureContext.root.children.length > 0,
  );
  const groupNodes: CompanyStructureNode[] = isGroupHead && structureContext
    ? flattenCompanyStructure(structureContext.root)
    : [];

  let groupSnapshots = new Map<number, StoredCompanyFinancialSummary>();
  let groupSnapshotError: string | null = null;
  if (groupNodes.length) {
    try {
      groupSnapshots = await getLatestCompanyFinanceSnapshots(
        groupNodes.map((node) => node.company.company_id),
      );
    } catch (error) {
      groupSnapshotError = error instanceof Error ? error.message : "Local group snapshots are unavailable.";
    }
  }

  if (!groupSnapshots.has(companyId)) {
    groupSnapshots.set(companyId, summary);
  }

  const syncedSnapshots = groupNodes
    .map((node) => groupSnapshots.get(node.company.company_id) ?? null)
    .filter((item): item is StoredCompanyFinancialSummary => item !== null);
  const allGroupSynced = groupNodes.length > 0 && syncedSnapshots.length === groupNodes.length;
  const groupCurrency = summary.currency;

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{summary.cref || company.reference || `Company ${company.company_id}`}</p>
          <h1>Finance</h1>
          <p className="muted">
            OGL order activity for {company.name}, served from the local snapshot when available.
          </p>
        </div>
        <div className="button-row">
          <span className="badge badge-neutral">
            {finance.source === "local" ? "Local snapshot · OGL" : "Live · OGL"}
          </span>
          <form action={refreshCompanyFinanceAction}>
            <input type="hidden" name="companyId" value={company.company_id} />
            <button className="button button-secondary button-compact" type="submit">
              Refresh finance
            </button>
          </form>
        </div>
      </header>

      {query.notice ? <div className="notice">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}
      {finance.persistence_error ? (
        <div className="error">
          Live finance is available, but the local snapshot store reported: {finance.persistence_error}
        </div>
      ) : null}
      {visibilityError ? (
        <div className="error">Finance visibility settings could not be loaded: {visibilityError}</div>
      ) : null}

      {columns.length ? (
        <section className={styles.summaryGrid} aria-label="Company financial summary">
          {visibility.show_year_to_date
            ? periodCard(`${summary.year} spend to date`, summary.year_to_date, summary.currency, true)
            : null}
          {visibility.show_last_7_days
            ? periodCard("Last 7 days", summary.last_7_days, summary.currency)
            : null}
          {visibility.show_last_30_days
            ? periodCard("Last 30 days", summary.last_30_days, summary.currency)
            : null}
          {visibility.show_last_3_months
            ? periodCard("Last 3 months", summary.last_3_months, summary.currency)
            : null}
          {visibility.show_last_6_months
            ? periodCard("Last 6 months", summary.last_6_months, summary.currency)
            : null}
          {visibility.show_last_365_days
            ? periodCard("Last 365 days", summary.last_365_days, summary.currency)
            : null}
        </section>
      ) : (
        <div className="notice">
          All Finance period cards are hidden by this company&apos;s Finance visibility settings.
        </div>
      )}

      {isGroupHead ? (
        <section className="card stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Company structure</p>
              <h2>Group finance snapshot</h2>
              <p className="muted">
                Latest stored snapshot for the group head and every visible child company.
              </p>
            </div>
            <div className="button-row">
              <span className="badge badge-neutral">
                {syncedSnapshots.length}/{groupNodes.length} synced
              </span>
              <form action={refreshCompanyGroupFinanceAction}>
                <input type="hidden" name="companyId" value={company.company_id} />
                <button className="button button-secondary button-compact" type="submit">
                  Refresh group finance
                </button>
              </form>
            </div>
          </div>

          {groupSnapshotError ? <div className="error">{groupSnapshotError}</div> : null}
          {structureError ? <div className="error">{structureError}</div> : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                  <th>Snapshot</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="cell-stack">
                      <strong>{allGroupSynced ? "All companies" : "All synced companies"}</strong>
                      <span className="muted small-text">
                        {syncedSnapshots.length} of {groupNodes.length} companies included
                      </span>
                    </div>
                  </td>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {groupPeriodCell(
                        aggregatePeriod(syncedSnapshots, column.key),
                        groupCurrency,
                        column.key === "last_365_days" ? "Source pending" : "Not synced",
                      )}
                    </td>
                  ))}
                  <td><span className="badge badge-neutral">Aggregate</span></td>
                </tr>

                {groupNodes.map((node) => {
                  const snapshot = groupSnapshots.get(node.company.company_id) ?? null;
                  return (
                    <tr key={node.company.company_id}>
                      <td>
                        <div className="cell-stack">
                          <Link className="row-link" href={`/companies/${node.company.company_id}/finance`}>
                            {node.company.name}
                          </Link>
                          <span className="muted small-text">
                            {node.company.reference || `Company ${node.company.company_id}`}
                            {node.company.company_id === companyId ? " · Group head" : ""}
                          </span>
                        </div>
                      </td>
                      {columns.map((column) => (
                        <td key={column.key}>
                          {groupPeriodCell(
                            snapshot ? snapshot[column.key] : null,
                            snapshot?.currency ?? groupCurrency,
                            snapshot
                              ? column.key === "last_365_days"
                                ? "Source pending"
                                : "No value"
                              : "Not synced",
                          )}
                        </td>
                      ))}
                      <td>
                        {snapshot ? (
                          <div className="cell-stack">
                            <strong>{formatTimestamp(snapshot.refreshed_at)}</strong>
                            <span className="muted small-text">OGL refreshed</span>
                          </div>
                        ) : (
                          <span className="badge badge-neutral">Not synced</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="muted small-text">
            Period columns follow the group head&apos;s Finance visibility settings. The All row includes the head plus children that currently have a stored snapshot.
          </p>
        </section>
      ) : null}

      <section className={`card ${styles.chartCard}`}>
        <div className={styles.chartHeader}>
          <div>
            <p className="eyebrow">January–December</p>
            <h2>{summary.year} monthly order value</h2>
            <p className="muted">Order value and order count from the OGL order history returned through Fluid.</p>
          </div>
          <span className="badge badge-neutral">{summary.currency}</span>
        </div>

        <div className={styles.chart} role="img" aria-label={`${summary.year} monthly OGL order value`}>
          {months.map((month) => {
            const height = Math.max(2, (month.value / maxMonthValue) * 100);
            return (
              <div
                className={styles.barColumn}
                key={month.month}
                title={`${monthLabel(month.month)}: ${formatAmount(month.value, summary.currency)} · ${month.order_count} orders`}
              >
                <span className={styles.barValue}>
                  {month.value > 0 ? formatCompactAmount(month.value, summary.currency) : "—"}
                </span>
                <div className={styles.barTrack} aria-hidden="true">
                  {month.value > 0 ? <div className={styles.barFill} style={{ height: `${height}%` }} /> : null}
                </div>
                <span className={styles.barLabel}>{monthLabel(month.month)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Source details</p>
          <h2>Financial data provenance</h2>
        </div>
        <dl className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <dt>OGL customer reference</dt>
            <dd>{summary.cref || "—"}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Last order</dt>
            <dd>{formatDate(summary.last_order_date)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Source refreshed</dt>
            <dd>{formatTimestamp(summary.refreshed_at)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Served from</dt>
            <dd>{finance.source === "local" ? "Local Postgres snapshot" : "Live Fluid GraphQL"}</dd>
          </div>
        </dl>
      </section>

      <p className={styles.readOnlyNote}>
        “Spend” in this workspace means OGL order value. It is not the accounting ledger balance and does not apply credits or other financial transactions unless Fluid explicitly adds those to the contract. Rolling 365-day data remains blank until the source contract provides that exact period.
      </p>
    </div>
  );
}

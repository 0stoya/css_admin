import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyFinancialSummary,
  type CompanyFinanceMonth,
  type CompanyFinancePeriod,
} from "@/lib/graphql/company-finance";
import styles from "@/components/company-finance-workspace.module.css";

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

function formatTimestamp(value: string) {
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

function periodCard(label: string, period: CompanyFinancePeriod, currency: string, primary = false) {
  return (
    <article className={`${styles.metricCard}${primary ? ` ${styles.metricCardPrimary}` : ""}`}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{formatAmount(period.value, currency)}</strong>
      <span className={styles.metricMeta}>
        {period.order_count} order{period.order_count === 1 ? "" : "s"}
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

async function loadFinance(companyId: number) {
  const [companyResult, financeResult] = await Promise.allSettled([
    getCompany(companyId),
    getCompanyFinancialSummary(companyId),
  ]);

  return {
    company: companyResult.status === "fulfilled" ? companyResult.value : null,
    companyError: companyResult.status === "rejected" ? graphQLErrorMessage(companyResult.reason) : null,
    finance: financeResult.status === "fulfilled" ? financeResult.value : null,
    financeError: financeResult.status === "rejected" ? graphQLErrorMessage(financeResult.reason) : null,
  };
}

export default async function CompanyFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const { company, companyError, finance, financeError } = await loadFinance(companyId);

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
            This workspace expects the Fluid GraphQL financial-summary contract. The rest of the company record remains available while that backend capability is unavailable.
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

  const months = normaliseMonths(finance.monthly);
  const maxMonthValue = Math.max(1, ...months.map((month) => month.value));

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{finance.cref || company.reference || `Company ${company.company_id}`}</p>
          <h1>Finance</h1>
          <p className="muted">OGL order activity aggregated by Fluid for {company.name}.</p>
        </div>
        <span className="badge badge-neutral">Read only · OGL</span>
      </header>

      <section className={styles.summaryGrid} aria-label="Company financial summary">
        {periodCard(`${finance.year} spend to date`, finance.year_to_date, finance.currency, true)}
        {periodCard("Last 7 days", finance.last_7_days, finance.currency)}
        {periodCard("Last 30 days", finance.last_30_days, finance.currency)}
        {periodCard("Last 3 months", finance.last_3_months, finance.currency)}
        {periodCard("Last 6 months", finance.last_6_months, finance.currency)}
      </section>

      <section className={`card ${styles.chartCard}`}>
        <div className={styles.chartHeader}>
          <div>
            <p className="eyebrow">January–December</p>
            <h2>{finance.year} monthly order value</h2>
            <p className="muted">Order value and order count from the OGL order history returned through Fluid.</p>
          </div>
          <span className="badge badge-neutral">{finance.currency}</span>
        </div>

        <div className={styles.chart} role="img" aria-label={`${finance.year} monthly OGL order value`}>
          {months.map((month) => {
            const height = Math.max(2, (month.value / maxMonthValue) * 100);
            return (
              <div className={styles.barColumn} key={month.month} title={`${monthLabel(month.month)}: ${formatAmount(month.value, finance.currency)} · ${month.order_count} orders`}>
                <span className={styles.barValue}>{month.value > 0 ? formatCompactAmount(month.value, finance.currency) : "—"}</span>
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
            <dd>{finance.cref || "—"}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Last order</dt>
            <dd>{formatDate(finance.last_order_date)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Refreshed</dt>
            <dd>{formatTimestamp(finance.refreshed_at)}</dd>
          </div>
          <div className={styles.detailItem}>
            <dt>Source</dt>
            <dd>OGL WebConnector via Fluid</dd>
          </div>
        </dl>
      </section>

      <p className={styles.readOnlyNote}>
        “Spend” in this workspace currently means OGL order value. It is not the accounting ledger balance and does not apply credits or other financial transactions unless Fluid explicitly adds those to the contract later.
      </p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyCredit, type CompanyCredit } from "@/lib/graphql/company-credit";
import styles from "@/components/company-credit-workspace.module.css";

async function loadCompanyCredit(companyId: number) {
  try {
    const [company, credit] = await Promise.all([
      getCompany(companyId),
      getCompanyCredit(companyId),
    ]);

    return { company, credit, error: null };
  } catch (error) {
    return { company: null, credit: null, error: graphQLErrorMessage(error) };
  }
}

function formatAmount(value: number | null, currency: string | null) {
  if (value === null) return "—";

  if (currency) {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  return value.toFixed(2);
}

function utilisation(credit: CompanyCredit) {
  if (credit.credit_limit === null || credit.used_amount === null || credit.credit_limit <= 0) {
    return null;
  }

  return (credit.used_amount / credit.credit_limit) * 100;
}

function accountStatus(credit: CompanyCredit) {
  if (!credit.has_credit_account) return "No credit account";
  if (credit.remaining_amount !== null && credit.remaining_amount < 0) return "Over credit limit";
  return "Credit account active";
}

export default async function CompanyCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const { company, credit, error } = await loadCompanyCredit(companyId);

  if (!company || !credit) {
    return (
      <div className="stack">
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Company credit unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const usage = utilisation(credit);
  const usageBar = usage === null ? 0 : Math.min(100, Math.max(0, usage));
  const isOverLimit = credit.remaining_amount !== null && credit.remaining_amount < 0;

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Credit account</p>
          <h1>Company credit</h1>
          <p className="muted">Current credit position and policy returned directly by Fluid.</p>
        </div>
        <Link className="button button-secondary button-link" href={`/companies/${company.company_id}/credit-orders`}>
          Open credit orders
        </Link>
      </header>

      {!credit.has_credit_account ? (
        <section className={`card ${styles.emptyState}`}>
          <div className={styles.emptyIcon} aria-hidden="true">£</div>
          <div>
            <span className="badge badge-neutral">No credit account</span>
            <h2>No company credit is configured</h2>
            <p className="muted">
              Fluid returned no credit account for this company. Credit values are read-only in this portal.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className={`card ${styles.positionCard}`}>
            <div className={styles.positionHeading}>
              <div>
                <p className="eyebrow">Credit position</p>
                <h2>{formatAmount(credit.remaining_amount, credit.currency)}</h2>
                <p className="muted">Available credit</p>
              </div>
              <span className={`badge ${isOverLimit ? styles.dangerBadge : "badge-ok"}`}>
                {accountStatus(credit)}
              </span>
            </div>

            <div className={styles.amountGrid}>
              <div className={styles.amountMetric}>
                <span>Credit limit</span>
                <strong>{formatAmount(credit.credit_limit, credit.currency)}</strong>
              </div>
              <div className={styles.amountMetric}>
                <span>Used credit</span>
                <strong>{formatAmount(credit.used_amount, credit.currency)}</strong>
              </div>
              <div className={styles.amountMetric}>
                <span>Available</span>
                <strong className={isOverLimit ? styles.dangerText : undefined}>
                  {formatAmount(credit.remaining_amount, credit.currency)}
                </strong>
              </div>
            </div>

            <div className={styles.usageBlock}>
              <div className={styles.usageHeading}>
                <span>Credit used</span>
                <strong>{usage === null ? "—" : `${usage.toFixed(1)}%`}</strong>
              </div>
              <div className={styles.usageTrack} aria-hidden="true">
                <div
                  className={`${styles.usageFill} ${isOverLimit ? styles.usageFillOver : ""}`}
                  style={{ width: `${usageBar}%` }}
                />
              </div>
              {isOverLimit ? (
                <p className={styles.overLimitNote}>
                  The returned used balance is above the configured credit limit.
                </p>
              ) : null}
            </div>
          </section>

          <div className={styles.detailGrid}>
            <section className={`card ${styles.policyCard}`}>
              <div className={styles.cardHeading}>
                <div>
                  <p className="eyebrow">Policy</p>
                  <h2>Credit policy</h2>
                </div>
                <span className={`badge ${credit.allow_over_limit ? styles.warningBadge : "badge-neutral"}`}>
                  {credit.allow_over_limit ? "Over limit allowed" : "Hard limit"}
                </span>
              </div>

              <div className={styles.policyRows}>
                <div>
                  <span>Over-limit purchases</span>
                  <strong>{credit.allow_over_limit ? "Allowed" : "Not allowed"}</strong>
                </div>
                <div>
                  <span>Currency</span>
                  <strong>{credit.currency ?? "—"}</strong>
                </div>
                <div>
                  <span>Credit account ID</span>
                  <strong>{credit.credit_id ?? "—"}</strong>
                </div>
              </div>
            </section>

            <section className={`card ${styles.workflowCard}`}>
              <div>
                <p className="eyebrow">Credit workflow</p>
                <h2>Credit orders</h2>
                <p className="muted">
                  Review the company&apos;s credit-order queue, status and Fluid-authorized approval actions.
                </p>
              </div>
              <Link className="button button-link" href={`/companies/${company.company_id}/credit-orders`}>
                View credit orders
              </Link>
            </section>
          </div>

          <p className={styles.readOnlyNote}>
            Credit limit, balance and over-limit policy are read-only here and are not recalculated by the Admin portal.
          </p>
        </>
      )}
    </div>
  );
}

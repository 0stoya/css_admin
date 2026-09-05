import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyCredit } from "@/lib/graphql/company-credit";

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

export default async function CompanyCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const { company, credit, error } = await loadCompanyCredit(companyId);

  if (!company || !credit) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
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

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span>
        <span>Company credit</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Company credit</h1>
          <p className="muted">Read-only credit account state returned by Fluid for {company.name}.</p>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{formatAmount(credit.credit_limit, credit.currency)}</span>
          <span className="stat-label">Credit limit</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatAmount(credit.used_amount, credit.currency)}</span>
          <span className="stat-label">Used amount</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatAmount(credit.remaining_amount, credit.currency)}</span>
          <span className="stat-label">Remaining amount</span>
        </div>
      </div>

      <section className="card stack">
        <div className="card-heading-row">
          <div>
            <h2>Current credit state</h2>
            <p className="muted">Values are displayed exactly from the backend; the Admin app does not calculate or modify credit.</p>
          </div>
          <div className={`badge ${credit.has_credit_account ? "badge-ok" : "badge-neutral"}`}>
            {credit.has_credit_account ? "Credit account" : "No credit account"}
          </div>
        </div>

        <dl className="detail-list">
          <dt>Company ID</dt><dd>{credit.company_id}</dd>
          <dt>Credit ID</dt><dd>{credit.credit_id ?? "—"}</dd>
          <dt>Currency</dt><dd>{credit.currency ?? "—"}</dd>
          <dt>Credit account</dt><dd>{credit.has_credit_account ? "Yes" : "No"}</dd>
          <dt>Allow over limit</dt><dd>{credit.allow_over_limit ? "Yes" : "No"}</dd>
        </dl>
      </section>

      <section className="card stack">
        <div>
          <h2>Read-only value</h2>
          <p className="muted">
            Company credit is informational in this Admin product. There are intentionally no controls here to change the credit limit, used balance or over-limit policy.
          </p>
        </div>
      </section>
    </div>
  );
}

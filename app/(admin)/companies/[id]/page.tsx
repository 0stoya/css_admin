import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyPricingStatus } from "@/lib/graphql/company-pricing";

const managementAreas = [
  {
    key: "management",
    label: "Company management",
    description: "Users, roles and Fluid company ACL resources.",
    href: (companyId: number) => `/companies/${companyId}/management`,
  },
  {
    key: "catalog",
    label: "Catalogue policy",
    description: "Company and role catalogue visibility.",
    href: (companyId: number) => `/companies/${companyId}/catalog`,
  },
  {
    key: "purchase-controls",
    label: "Purchase controls",
    description: "Role templates, limits and assignments.",
    href: (companyId: number) => `/companies/${companyId}/purchase-controls`,
  },
  {
    key: "payment",
    label: "Payment configuration",
    description: "Company-specific payment-method configuration.",
    href: (companyId: number) => `/companies/${companyId}/payment`,
  },
  {
    key: "credit",
    label: "Company credit",
    description: "Read-only credit limit, usage and remaining balance.",
    href: (companyId: number) => `/companies/${companyId}/credit`,
  },
  {
    key: "credit-orders",
    label: "Credit orders",
    description: "Administrative credit-order queues and lifecycle.",
    href: (companyId: number) => `/companies/${companyId}/credit-orders`,
  },
] as const;

async function loadCompany(companyId: number) {
  const [companyResult, pricingResult] = await Promise.allSettled([
    getCompany(companyId),
    getCompanyPricingStatus(companyId),
  ]);

  if (companyResult.status === "rejected") {
    return {
      company: null,
      pricing: null,
      pricingError: null,
      error: graphQLErrorMessage(companyResult.reason),
    };
  }

  return {
    company: companyResult.value,
    pricing: pricingResult.status === "fulfilled" ? pricingResult.value : null,
    pricingError: pricingResult.status === "rejected" ? graphQLErrorMessage(pricingResult.reason) : null,
    error: null,
  };
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    notFound();
  }

  const { company, pricing, pricingError, error } = await loadCompany(companyId);

  if (!company) {
    return (
      <div className="stack">
        <div><Link className="back-link" href="/companies">← Companies</Link></div>
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Company unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const pricingSource = pricing?.has_custom_prices ? "OGL company-specific pricing" : "Magento pricing";

  return (
    <div className="stack">
      <div><Link className="back-link" href="/companies">← Companies</Link></div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>{company.name}</h1>
          <p className="muted">Company detail and management entry points. Each management surface remains backend-authorized.</p>
        </div>
      </header>

      <section className="card">
        <h2>Company detail</h2>
        <dl className="detail-list">
          <dt>Reference</dt><dd>{company.reference || "—"}</dd>
          <dt>Company ID</dt><dd>{company.company_id}</dd>
          <dt>Sales representative ID</dt><dd>{company.sales_representative_id ?? "Unassigned"}</dd>
        </dl>
      </section>

      <section className="card stack">
        <div>
          <h2>Company settings & lifecycle</h2>
          <p className="muted">Review OGL-owned company data, maintain Magento-local settings and use the guarded exact-reference delete flow.</p>
        </div>
        <Link className="button button-link" href={`/companies/${company.company_id}/settings`}>
          Open company settings
        </Link>
      </section>

      <section className="card stack">
        <div>
          <h2>Import / export</h2>
          <p className="muted">Export or preview company users, roles and product restrictions before applying Fluid-authorized changes.</p>
        </div>
        <Link className="button button-link" href={`/companies/${company.company_id}/import-export`}>
          Open import / export
        </Link>
      </section>

      {pricing ? (
        <section className="card stack">
          <div className="card-heading-row">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2>{pricingSource}</h2>
              <p className="muted">
                {pricing.has_custom_prices
                  ? `${pricing.custom_price_count} custom price row${pricing.custom_price_count === 1 ? "" : "s"}; custom prices ${pricing.status_message}.`
                  : `No OGL custom prices are currently available; ${pricing.status_message}.`}
              </p>
            </div>
            <div className={`badge ${pricing.has_custom_prices ? "badge-ok" : "badge-neutral"}`}>
              {pricing.has_custom_prices ? "Custom pricing" : "Magento fallback"}
            </div>
          </div>
          <dl className="detail-list">
            <dt>Company active</dt><dd>{pricing.company_active ? "Yes" : "No"}</dd>
            <dt>OGL sync</dt><dd>{pricing.sync_enabled ? "Enabled" : "Disabled"}</dd>
            <dt>Import status</dt><dd>{pricing.import_status}</dd>
          </dl>
          <Link className="button button-link" href={`/companies/${company.company_id}/pricing`}>
            View pricing status & custom prices
          </Link>
        </section>
      ) : (
        <section className="card stack">
          <div>
            <p className="eyebrow">Pricing</p>
            <h2>Pricing status unavailable</h2>
            <p className="muted">Pricing access is independent from the company overview and may be restricted for scoped administrators.</p>
          </div>
          {pricingError ? <div className="error">{pricingError}</div> : null}
          <Link className="button button-link" href={`/companies/${company.company_id}/pricing`}>
            Open pricing status
          </Link>
        </section>
      )}

      <section className="stack">
        <div>
          <h2>Management areas</h2>
          <p className="muted">Open an area to use its backend-authorized surface. Scoped administrators may receive a restricted state from Fluid rather than a hidden or inferred permission.</p>
        </div>
        <div className="grid">
          {managementAreas.map((area) => (
            <article className="card stack" key={area.key}>
              <div>
                <h3>{area.label}</h3>
                <p className="muted">{area.description}</p>
              </div>
              <Link className="button button-link" href={area.href(company.company_id)}>
                Open {area.label.toLowerCase()}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

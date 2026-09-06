import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyStructureCard } from "@/components/company-structure-card";
import {
  buildCompanyStructure,
  countStructureCompanies,
  findCompanyStructureContext,
} from "@/lib/company-structure";
import { getAllCompanies, getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { getCompanyPricingStatus } from "@/lib/graphql/company-pricing";

async function loadCompany(companyId: number) {
  const [companyResult, pricingResult, structureResult, managementResult] = await Promise.allSettled([
    getCompany(companyId),
    getCompanyPricingStatus(companyId),
    getAllCompanies(),
    getCompanyManagement(companyId),
  ]);

  if (companyResult.status === "rejected") {
    return {
      company: null,
      pricing: null,
      pricingError: null,
      structure: null,
      structureError: null,
      management: null,
      error: graphQLErrorMessage(companyResult.reason),
    };
  }

  return {
    company: companyResult.value,
    pricing: pricingResult.status === "fulfilled" ? pricingResult.value : null,
    pricingError: pricingResult.status === "rejected" ? graphQLErrorMessage(pricingResult.reason) : null,
    structure: structureResult.status === "fulfilled" ? buildCompanyStructure(structureResult.value) : null,
    structureError: structureResult.status === "rejected" ? graphQLErrorMessage(structureResult.reason) : null,
    management: managementResult.status === "fulfilled" ? managementResult.value : null,
    error: null,
  };
}

function formatTimestamp(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    notFound();
  }

  const {
    company,
    pricing,
    pricingError,
    structure,
    structureError,
    management,
    error,
  } = await loadCompany(companyId);

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

  const structureContext = structure
    ? findCompanyStructureContext(structure, company.company_id)
    : null;
  const visibleStructureCount = structureContext
    ? countStructureCompanies(structureContext.root)
    : null;
  const parentNode = structureContext && structureContext.path.length > 1
    ? structureContext.path[structureContext.path.length - 2]
    : null;
  const isIndependent = Boolean(
    structureContext
    && visibleStructureCount === 1
    && structureContext.root.company.parent_company_id === null,
  );
  const isGroupHead = Boolean(
    structureContext
    && visibleStructureCount !== null
    && visibleStructureCount > 1
    && structureContext.root.company.company_id === company.company_id
    && structureContext.root.company.parent_company_id === null,
  );
  const structurePosition = !structureContext
    ? "Unavailable"
    : isIndependent
      ? "Independent"
      : isGroupHead
        ? "Group head"
        : parentNode
          ? `Child of ${parentNode.company.reference || parentNode.company.name}`
          : "Highest visible branch";

  const pricingSource = pricing?.has_custom_prices ? "OGL custom pricing" : "Magento pricing";
  const reference = company.reference || `Company ${company.company_id}`;

  return (
    <div className="stack company-overview">
      <div className="company-overview-heading-row">
        <Link className="back-link" href="/companies">← Companies</Link>
      </div>

      <header className="page-header company-overview-header">
        <div>
          <p className="eyebrow">{reference}</p>
          <h1>Company overview</h1>
          <p className="muted">Account status, company structure and integration health for {company.name}.</p>
        </div>
      </header>

      <div className="company-overview-stats" aria-label="Company summary">
        <article className="company-overview-stat">
          <span className="company-overview-stat-value">{reference}</span>
          <span className="company-overview-stat-label">Company reference</span>
          <span className="company-overview-stat-meta">Magento company #{company.company_id}</span>
        </article>
        <article className="company-overview-stat">
          <span className="company-overview-stat-value">{management ? management.users.length : "—"}</span>
          <span className="company-overview-stat-label">Company users</span>
          <span className="company-overview-stat-meta">{management ? "Fluid membership" : "Access restricted"}</span>
        </article>
        <article className="company-overview-stat">
          <span className="company-overview-stat-value">{management ? management.roles.length : "—"}</span>
          <span className="company-overview-stat-label">Roles</span>
          <span className="company-overview-stat-meta">{management ? "Company access roles" : "Access restricted"}</span>
        </article>
        <article className="company-overview-stat">
          <span className="company-overview-stat-value">{visibleStructureCount ?? "—"}</span>
          <span className="company-overview-stat-label">Visible structure</span>
          <span className="company-overview-stat-meta">{structurePosition}</span>
        </article>
      </div>

      <div className="company-overview-grid">
        <div className="company-overview-main">
          {structure ? (
            <CompanyStructureCard roots={structure} companyId={company.company_id} />
          ) : (
            <section className="card stack">
              <div>
                <p className="eyebrow">Company structure</p>
                <h2>Structure unavailable</h2>
                <p className="muted">The company remains usable; its parent/child structure could not be loaded in the current admin scope.</p>
              </div>
              {structureError ? (
                <details className="overview-error-detail">
                  <summary>Technical details</summary>
                  <div className="error">{structureError}</div>
                </details>
              ) : null}
            </section>
          )}
        </div>

        <aside className="company-overview-rail" aria-label="Company status">
          <section className="card stack company-overview-panel">
            <div>
              <p className="eyebrow">Company record</p>
              <h2>Account details</h2>
            </div>
            <dl className="company-overview-detail-list">
              <div><dt>Reference</dt><dd>{company.reference || "—"}</dd></div>
              <div><dt>Magento company ID</dt><dd>{company.company_id}</dd></div>
              <div><dt>Sales representative</dt><dd>{company.sales_representative_id ?? "Unassigned"}</dd></div>
              <div><dt>Structure</dt><dd>{structurePosition}</dd></div>
              {parentNode ? (
                <div><dt>Parent company</dt><dd><Link href={`/companies/${parentNode.company.company_id}`}>{parentNode.company.reference || parentNode.company.name}</Link></dd></div>
              ) : null}
            </dl>
          </section>

          <section className="card stack company-overview-panel">
            <div className="company-overview-panel-heading">
              <div>
                <p className="eyebrow">Pricing & OGL</p>
                <h2>Integration status</h2>
              </div>
              {pricing ? (
                <span className={`badge ${pricing.has_custom_prices ? "badge-ok" : "badge-neutral"}`}>
                  {pricing.has_custom_prices ? "Custom pricing" : "Magento fallback"}
                </span>
              ) : null}
            </div>

            {pricing ? (
              <>
                <p className="muted small-text">{pricingSource}. {pricing.status_message}</p>
                <dl className="company-overview-detail-list">
                  <div><dt>Company active</dt><dd><span className={`badge ${pricing.company_active ? "badge-ok" : "badge-restricted"}`}>{pricing.company_active ? "Yes" : "No"}</span></dd></div>
                  <div><dt>OGL sync</dt><dd><span className={`badge ${pricing.sync_enabled ? "badge-ok" : "badge-neutral"}`}>{pricing.sync_enabled ? "Enabled" : "Disabled"}</span></dd></div>
                  <div><dt>Import status</dt><dd>{pricing.import_status}</dd></div>
                  <div><dt>Custom price rows</dt><dd>{pricing.custom_price_count}</dd></div>
                  <div><dt>Last imported</dt><dd>{formatTimestamp(pricing.last_imported_at)}</dd></div>
                </dl>
                <Link className="company-overview-text-link" href={`/companies/${company.company_id}/pricing`}>View pricing details →</Link>
              </>
            ) : (
              <>
                <p className="muted">Pricing status is unavailable in the current admin scope. The rest of the company overview remains usable.</p>
                {pricingError ? (
                  <details className="overview-error-detail">
                    <summary>Technical details</summary>
                    <div className="error">{pricingError}</div>
                  </details>
                ) : null}
                <Link className="company-overview-text-link" href={`/companies/${company.company_id}/pricing`}>Open pricing status →</Link>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany, getCompanyManagementAvailability } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";

const managementLabels = {
  management: "Company management",
  catalog: "Catalogue policy",
  purchase_controls: "Purchase controls",
  commercial: "Payment configuration",
  credit_orders: "Credit orders",
} as const;

async function loadCompany(companyId: number) {
  try {
    const [company, availability] = await Promise.all([
      getCompany(companyId),
      getCompanyManagementAvailability(companyId),
    ]);

    return { company, availability, error: null };
  } catch (error) {
    return { company: null, availability: null, error: graphQLErrorMessage(error) };
  }
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    notFound();
  }

  const { company, availability, error } = await loadCompany(companyId);

  if (!company || !availability) {
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

  return (
    <div className="stack">
      <div><Link className="back-link" href="/companies">← Companies</Link></div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>{company.name}</h1>
          <p className="muted">Server-authorized company detail and management surfaces.</p>
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

      <section className="stack">
        <div>
          <h2>Management areas</h2>
          <p className="muted">Availability comes from the accepted Fluid GraphQL surfaces; restricted areas stay restricted rather than being inferred client-side.</p>
        </div>
        <div className="grid">
          {(Object.keys(managementLabels) as Array<keyof typeof managementLabels>).map((key) => (
            <article className="card" key={key}>
              <div className={`badge ${availability[key] ? "badge-ok" : "badge-restricted"}`}>
                {availability[key] ? "Available" : "Restricted"}
              </div>
              <h3>{managementLabels[key]}</h3>
              <p className="muted">{availability[key] ? "Backend surface accepted for this company/admin context." : "Backend authorization or domain access did not expose this surface."}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

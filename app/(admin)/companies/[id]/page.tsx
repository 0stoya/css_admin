import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany, getCompanyManagementAvailability } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";

const managementAreas = {
  management: {
    label: "Company management",
    description: "Users, roles and Fluid company ACL resources.",
  },
  catalog: {
    label: "Catalogue policy",
    description: "Company and role catalogue visibility.",
  },
  purchase_controls: {
    label: "Purchase controls",
    description: "Role templates, limits and assignments.",
  },
  commercial: {
    label: "Payment configuration",
    description: "Payment, credit and commercial configuration.",
  },
  credit_orders: {
    label: "Credit orders",
    description: "Administrative credit-order queues and lifecycle.",
  },
} as const;

const managementLinks: Partial<Record<keyof typeof managementAreas, (companyId: number) => string>> = {
  management: (companyId) => `/companies/${companyId}/management`,
  catalog: (companyId) => `/companies/${companyId}/catalog`,
  purchase_controls: (companyId) => `/companies/${companyId}/purchase-controls`,
};

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

      <section className="card stack">
        <div>
          <h2>Company settings & lifecycle</h2>
          <p className="muted">Review OGL-owned company data, maintain Magento-local settings and use the guarded exact-reference delete flow.</p>
        </div>
        <Link className="button button-link" href={`/companies/${company.company_id}/settings`}>
          Open company settings
        </Link>
      </section>

      <section className="stack">
        <div>
          <h2>Management areas</h2>
          <p className="muted">Availability comes from the accepted Fluid GraphQL surfaces; restricted areas stay restricted rather than being inferred client-side.</p>
        </div>
        <div className="grid">
          {(Object.keys(managementAreas) as Array<keyof typeof managementAreas>).map((key) => {
            const area = managementAreas[key];
            const isAvailable = availability[key];
            const href = managementLinks[key]?.(company.company_id);

            return (
              <article className="card stack" key={key}>
                <div className={`badge ${isAvailable ? "badge-ok" : "badge-restricted"}`}>
                  {isAvailable ? "Available" : "Restricted"}
                </div>
                <div>
                  <h3>{area.label}</h3>
                  <p className="muted">{area.description}</p>
                </div>
                {href && isAvailable ? (
                  <Link className="button button-link" href={href}>
                    Open {area.label.toLowerCase()}
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

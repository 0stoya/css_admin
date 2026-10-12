import { notFound } from "next/navigation";
import { CompanyFlatImportPanels } from "@/components/flat-company-imports";
import { buildCompanyStructure, findCompanyStructureContext } from "@/lib/company-structure";
import { getAllCompanies, getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";

export default async function CompanyImportExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  let company;
  try {
    company = await getCompany(companyId);
  } catch (error) {
    return (
      <div className="stack">
        <section className="card stack">
          <div><p className="eyebrow">Backend request failed</p><h1>Import / export unavailable</h1></div>
          <div className="error">{graphQLErrorMessage(error)}</div>
        </section>
      </div>
    );
  }

  if (!company.reference?.trim()) {
    return (
      <div className="stack section-gap">
        <header className="page-header">
          <div>
            <p className="eyebrow">Data portability</p>
            <h1>Import / export</h1>
            <p className="muted">Move company users, roles and product restrictions through guarded CSV workflows.</p>
          </div>
        </header>
        <section className="card stack">
          <div><p className="eyebrow">Company reference required</p><h2>CSV workflows are unavailable</h2></div>
          <div className="error">Flat CSV imports use company_ref as their safety and routing key. Add a company reference before using Import / export.</div>
        </section>
      </div>
    );
  }

  const companyRef = company.reference.trim();
  const visible = await getAllCompanies().catch(() => null);
  const structure = visible ? findCompanyStructureContext(buildCompanyStructure(visible), companyId) : null;
  const canExportStructure = Boolean(
    structure && structure.root.descendant_count > 0 && structure.root.company.parent_company_id === null,
  );
  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Data portability</p>
          <h1>Import / export</h1>
          <p className="muted">Download current data, prepare a CSV and preview every change before anything is applied to this company.</p>
        </div>
        {canExportStructure ? (
          <a className="button button-secondary button-link" href={`/api/companies/${companyId}/exports/structure-snapshot`}>
            Download structure snapshot (.xlsx)
          </a>
        ) : null}
      </header>
      {canExportStructure ? (
        <p className="muted small-text">One read-only workbook for the visible company group: companies, users, roles and stored product SKU restrictions. No categories or changes to Magento.</p>
      ) : null}
      <CompanyFlatImportPanels companyId={companyId} companyRef={companyRef} />
    </div>
  );
}

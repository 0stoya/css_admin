import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyControlsCsvImport, CompanyUsersCsvImport } from "@/components/company-import-export-spreadsheet";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyControlsBundle } from "@/lib/graphql/company-controls";
import { getCompanyManagement } from "@/lib/graphql/company-management";

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
        <div><Link className="back-link" href="/companies">← Companies</Link></div>
        <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Data portability unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>
      </div>
    );
  }

  const [managementResult, controlsResult] = await Promise.allSettled([
    getCompanyManagement(companyId),
    getCompanyControlsBundle(companyId),
  ]);
  const management = managementResult.status === "fulfilled" ? managementResult.value : null;
  const controls = controlsResult.status === "fulfilled" ? controlsResult.value : null;
  const managementError = managementResult.status === "rejected" ? graphQLErrorMessage(managementResult.reason) : null;
  const controlsError = controlsResult.status === "rejected" ? graphQLErrorMessage(controlsResult.reason) : null;

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span><span>Import / export</span>
      </div>

      <header className="page-header">
        <div><p className="eyebrow">Company {company.company_id}</p><h1>Import / export</h1><p className="muted">Preview every import before Fluid-authorized writes are applied to {company.name}.</p></div>
      </header>

      {management
        ? <CompanyUsersCsvImport companyId={companyId} userCount={management.users.length} />
        : <section className="card stack"><div><p className="eyebrow">Company users</p><h2>CSV import / export restricted</h2></div><div className="error">{managementError}</div></section>}

      {controls
        ? <CompanyControlsCsvImport companyId={companyId} schemaVersion={controls.schema_version} roleCount={controls.role_controls.length} templateCount={controls.purchase_controls?.templates.length ?? 0} />
        : <section className="card stack"><div><p className="eyebrow">Company controls</p><h2>Controls import / export restricted</h2></div><div className="error">{controlsError}</div></section>}
    </div>
  );
}

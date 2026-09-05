import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyFlatImportPanels } from "@/components/flat-company-imports";
import { getCompany } from "@/lib/graphql/companies";
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
        <div><Link className="back-link" href="/companies">← Companies</Link></div>
        <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Data portability unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>
      </div>
    );
  }

  if (!company.reference?.trim()) {
    return (
      <div className="stack section-gap">
        <div className="breadcrumbs"><Link href="/companies">Companies</Link><span aria-hidden="true">/</span><Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span><span>Import / export</span></div>
        <section className="card stack"><div><p className="eyebrow">Company reference required</p><h1>Import / export unavailable</h1></div><div className="error">Flat CSV imports use company_ref as their safety/routing key. Add a company reference before using these imports.</div></section>
      </div>
    );
  }

  const companyRef = company.reference.trim();
  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span><span>Import / export</span>
      </div>
      <header className="page-header">
        <div><p className="eyebrow">{companyRef} · Company {company.company_id}</p><h1>Import / export</h1><p className="muted">Four focused CSV imports. Every row must carry company_ref {companyRef}; preview is mandatory before Fluid-authorized writes.</p></div>
      </header>
      <CompanyFlatImportPanels companyId={companyId} companyRef={companyRef} />
    </div>
  );
}

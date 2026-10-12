import type { ReactNode } from "react";
import { CompanyHeaderContext } from "@/components/app-header-context";
import { buildCompanyStructure, getCompanyStructureSwitchOptions } from "@/lib/company-structure";
import { getAllCompanies, getCompany } from "@/lib/graphql/companies";

export default async function CompanyScopedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) return children;

  const [company, visibleCompanies] = await Promise.all([
    getCompany(companyId).catch(() => null),
    getAllCompanies().catch(() => null),
  ]);
  if (!company) {
    // The requested page remains responsible for its own unavailable/not-found state.
    return children;
  }

  // A failed or restricted list query must never break the company page.
  // An incomplete visible hierarchy simply has no header switch options.
  const switchableCompanies = visibleCompanies
    ? getCompanyStructureSwitchOptions(
        buildCompanyStructure(visibleCompanies),
        company.company_id,
      ).map((item) => ({
        companyId: item.company_id,
        name: item.name,
        reference: item.reference,
        status: item.status,
      }))
    : [];

  return (
    <CompanyHeaderContext
      companyId={company.company_id}
      name={company.name}
      reference={company.reference}
      switchableCompanies={switchableCompanies}
    >
      {children}
    </CompanyHeaderContext>
  );
}

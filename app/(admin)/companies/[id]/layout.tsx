import type { ReactNode } from "react";
import { CompanyHeaderContext } from "@/components/app-header-context";
import { getCompany } from "@/lib/graphql/companies";

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

  const company = await getCompany(companyId).catch(() => null);
  if (!company) {
    // The requested page remains responsible for its own unavailable/not-found state.
    return children;
  }

  return (
    <CompanyHeaderContext
      companyId={company.company_id}
      name={company.name}
      reference={company.reference}
    >
      {children}
    </CompanyHeaderContext>
  );
}

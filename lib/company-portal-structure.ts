import {
  buildCompanyStructure,
  findCompanyStructureContext,
  type CompanyStructureContext,
  type CompanyStructureNode,
} from "@/lib/company-structure";
import type { CompanyPortalStructure } from "@/lib/graphql/company-portal";

export function buildCompanyPortalStructureRoots(
  structure: CompanyPortalStructure,
): CompanyStructureNode[] {
  return buildCompanyStructure(
    structure.companies.map((company) => ({
      company_id: company.company_id,
      reference: company.reference,
      status: company.active,
      name: company.name || `Company ${company.company_id}`,
      sales_representative_id: null,
      parent_company_id: company.parent_company_id,
    })),
  );
}

export function findCompanyPortalStructureContext(
  structure: CompanyPortalStructure,
  companyId: number,
): CompanyStructureContext | null {
  return findCompanyStructureContext(
    buildCompanyPortalStructureRoots(structure),
    companyId,
  );
}

import { getAllCompanies, type CompanySummary } from "@/lib/graphql/companies";
import { graphqlRequest } from "@/lib/graphql/client";
import { buildCompanyStructure, findCompanyStructureContext, flattenCompanyStructure } from "@/lib/company-structure";
import { isBulkExportKind, prepareBulkCompanies } from "@/lib/bulk-export-csv";
import type { ExportKind } from "@/lib/admin-export-jobs";

export type StaffJobIdentity = { user_id: number; username: string; active: boolean };
type CurrentUserData = { css_admin_current_user: StaffJobIdentity };

const CURRENT_USER = /* GraphQL */ `
  query AdminExportJobCurrentUser {
    css_admin_current_user { user_id username active }
  }
`;

export async function currentStaffJobIdentity(): Promise<StaffJobIdentity> {
  const data = await graphqlRequest<CurrentUserData, Record<string, never>>(CURRENT_USER, {});
  const user = data.css_admin_current_user;
  if (!user || !Number.isSafeInteger(user.user_id) || user.user_id < 1 || !user.active) {
    throw new Error("An active Magento Staff Admin identity is required.");
  }
  return user;
}

export function allowedStructureCompanies(visible: CompanySummary[], selectedCompanyId: number) {
  const context = findCompanyStructureContext(buildCompanyStructure(visible), selectedCompanyId);
  if (!context || context.root.descendant_count === 0 ||
      context.root.company.parent_company_id !== null) {
    throw new Error("No complete, visible company structure is available for this export.");
  }
  const companies = flattenCompanyStructure(context.root).map(entry => entry.company);
  if (companies.length > 80) {
    throw new Error("A scheduled structure export supports at most 80 companies.");
  }
  return { root: context.root.company, companies };
}

export function canDownloadScopedJob(
  visible: CompanySummary[], rootId: number, approvedIds: number[],
): boolean {
  try {
    const { root, companies } = allowedStructureCompanies(visible, rootId);
    const current = new Set(companies.map(company => company.company_id));
    return root.company_id === rootId &&
      approvedIds.length >= 2 &&
      approvedIds.every(id => current.has(id)) &&
      new Set(approvedIds).size === approvedIds.length;
  } catch { return false; }
}

export function canDownloadBulkScopedJob(
  visible: CompanySummary[], kind: ExportKind, approvedIds: number[],
): boolean {
  if (!isBulkExportKind(kind) || !approvedIds.length || approvedIds.length > 10000 ||
      new Set(approvedIds).size !== approvedIds.length) return false;
  const byId = new Map(visible.map(company => [company.company_id, company] as const));
  if (approvedIds.some(id => !byId.has(id))) return false;
  try {
    const approved = approvedIds.map(id => byId.get(id)!);
    return prepareBulkCompanies(kind, approved).length === approvedIds.length;
  } catch { return false; }
}

export async function ensureJobDownloadScope(
  rootId: number, companyIds: number[], kind: ExportKind = "company_structure_products",
) {
  const visible = await getAllCompanies();
  const allowed = isBulkExportKind(kind)
    ? canDownloadBulkScopedJob(visible, kind, companyIds)
    : canDownloadScopedJob(visible, rootId, companyIds);
  if (!allowed) throw new Error("Company access changed since this export was requested.");
}

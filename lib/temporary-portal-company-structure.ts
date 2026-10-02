import { readFile } from "node:fs/promises";
import {
  buildCompanyStructure,
  countStructureCompanies,
  findCompanyStructureContext,
  type CompanyStructureNode,
} from "@/lib/company-structure";
import type { CompanySummary } from "@/lib/graphql/companies";

/**
 * TEMPORARY QUICK-AND-DIRTY PRESENTATION BRIDGE.
 *
 * Remove this file once Fluid exposes the customer-authorised company hierarchy
 * contract. This deliberately reads a short-lived, server-only snapshot instead
 * of weakening Portal auth or reusing the Magento Admin GraphQL surface.
 */
export const TEMPORARY_PORTAL_STRUCTURE_PATCH =
  "temporary-portal-company-structure-snapshot-v1";

const DEFAULT_SNAPSHOT_PATH = "/etc/css-admin/portal-company-structure.json";
const MAX_SNAPSHOT_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

type SnapshotFile = {
  kind: typeof TEMPORARY_PORTAL_STRUCTURE_PATCH;
  generated_at: string;
  expires_at: string;
  companies: CompanySummary[];
  group_finance_company_ids: number[];
};

export type TemporaryPortalCompanyStructure =
  | {
      status: "ready";
      root: CompanyStructureNode;
      current_company_id: number;
      company_count: number;
      can_view_group_finance: boolean;
      expires_at: string;
    }
  | {
      status: "unavailable";
      reason: "missing" | "invalid" | "expired" | "not-listed";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseCompany(value: unknown): CompanySummary | null {
  if (!isRecord(value)) return null;

  const companyId = Number(value.company_id);
  const parentCompanyId = value.parent_company_id === null
    ? null
    : Number(value.parent_company_id);

  if (
    !Number.isInteger(companyId)
    || companyId < 1
    || (parentCompanyId !== null && (!Number.isInteger(parentCompanyId) || parentCompanyId < 1))
    || typeof value.name !== "string"
    || typeof value.status !== "boolean"
    || (value.reference !== null && typeof value.reference !== "string")
  ) {
    return null;
  }

  const salesRepresentativeId = value.sales_representative_id === null
    || value.sales_representative_id === undefined
    ? null
    : Number(value.sales_representative_id);

  if (
    salesRepresentativeId !== null
    && (!Number.isInteger(salesRepresentativeId) || salesRepresentativeId < 1)
  ) {
    return null;
  }

  return {
    company_id: companyId,
    reference: value.reference as string | null,
    status: value.status,
    name: value.name,
    sales_representative_id: salesRepresentativeId,
    parent_company_id: parentCompanyId,
  };
}

function parseSnapshot(value: unknown): SnapshotFile | null {
  if (!isRecord(value) || value.kind !== TEMPORARY_PORTAL_STRUCTURE_PATCH) return null;
  if (!Array.isArray(value.companies)) return null;

  const generatedAt = parseDate(value.generated_at);
  const expiresAt = parseDate(value.expires_at);
  if (generatedAt === null || expiresAt === null || expiresAt <= generatedAt) return null;
  if (expiresAt - generatedAt > MAX_SNAPSHOT_LIFETIME_MS) return null;

  const companies = value.companies.map(parseCompany);
  if (companies.some((company) => company === null)) return null;

  const rawGroupFinanceIds = value.group_finance_company_ids ?? [];
  if (!Array.isArray(rawGroupFinanceIds)) return null;
  const groupFinanceCompanyIds = rawGroupFinanceIds.map(Number);
  if (groupFinanceCompanyIds.some((companyId) => !Number.isInteger(companyId) || companyId < 1)) {
    return null;
  }

  const ids = new Set<number>();
  for (const company of companies as CompanySummary[]) {
    if (ids.has(company.company_id)) return null;
    ids.add(company.company_id);
  }

  if (groupFinanceCompanyIds.some((companyId) => !ids.has(companyId))) return null;

  return {
    kind: TEMPORARY_PORTAL_STRUCTURE_PATCH,
    generated_at: value.generated_at as string,
    expires_at: value.expires_at as string,
    companies: companies as CompanySummary[],
    group_finance_company_ids: Array.from(new Set(groupFinanceCompanyIds)),
  };
}

export async function getTemporaryPortalCompanyStructure(
  companyId: number,
): Promise<TemporaryPortalCompanyStructure> {
  const snapshotPath = process.env.CSS_ADMIN_PORTAL_STRUCTURE_SNAPSHOT?.trim()
    || DEFAULT_SNAPSHOT_PATH;

  let raw: string;
  try {
    raw = await readFile(/* turbopackIgnore: true */ snapshotPath, "utf8");
  } catch {
    return { status: "unavailable", reason: "missing" };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { status: "unavailable", reason: "invalid" };
  }

  const snapshot = parseSnapshot(decoded);
  if (!snapshot) {
    return { status: "unavailable", reason: "invalid" };
  }

  if (Date.parse(snapshot.expires_at) <= Date.now()) {
    return { status: "unavailable", reason: "expired" };
  }

  const roots = buildCompanyStructure(snapshot.companies);
  const context = findCompanyStructureContext(roots, companyId);
  if (!context) {
    return { status: "unavailable", reason: "not-listed" };
  }

  const isCanonicalGroupHead = context.root.company.company_id === companyId
    && context.root.company.parent_company_id === null
    && context.root.children.length > 0;

  return {
    status: "ready",
    root: context.root,
    current_company_id: companyId,
    company_count: countStructureCompanies(context.root),
    can_view_group_finance: isCanonicalGroupHead
      && snapshot.group_finance_company_ids.includes(companyId),
    expires_at: snapshot.expires_at,
  };
}

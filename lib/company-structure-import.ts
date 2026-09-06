import { parseCsv, stringifyCsv } from "@/lib/csv";
import { getCompanies, type CompanySummary } from "@/lib/graphql/companies";
import {
  getCompanySettings,
  updateCompanySettings,
  type CompanySettings,
} from "@/lib/graphql/company-settings";
import type { FlatCompanyImportRow, ImportRowStatus } from "@/lib/import-export-types";

const MAX_ROWS = 5000;

type ResolvedCompany = CompanySummary & { reference: string };

type ParsedStructureRow = {
  row: number;
  companyReference: string;
  parentReference: string;
};

type PlannedStructureRow = FlatCompanyImportRow & {
  companyId: number | null;
  parentCompanyId: number | null;
  currentParentCompanyId: number | null;
  settings: CompanySettings | null;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function csvWithBom(rows: Array<Array<string | number>>) {
  return `\uFEFF${stringifyCsv(rows)}\r\n`;
}

async function getAllCompanies() {
  const companies: CompanySummary[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await getCompanies(page, 100);
    companies.push(...result.items);
    totalPages = result.page_info.total_pages;
    page += 1;
  } while (page <= totalPages);

  return companies;
}

function parseStructureCsv(source: string): ParsedStructureRow[] {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The company structure CSV file is empty.");
  if (rows.length - 1 > MAX_ROWS) {
    throw new Error(`CSV import is limited to ${MAX_ROWS.toLocaleString()} data rows per preview.`);
  }

  const headers = rows[0].map(normalized);
  if (
    headers.length !== 2
    || headers[0] !== "company_reference"
    || headers[1] !== "parent_reference"
    || new Set(headers).size !== headers.length
  ) {
    throw new Error("CSV headers must be exactly: company_reference, parent_reference.");
  }
  if (rows.length === 1) throw new Error("The company structure CSV contains no data rows.");

  return rows.slice(1).map((values, index) => ({
    row: index + 2,
    companyReference: (values[0] ?? "").trim(),
    parentReference: (values[1] ?? "").trim(),
  }));
}

function publicRow(row: PlannedStructureRow): FlatCompanyImportRow {
  return {
    row: row.row,
    company_ref: row.company_ref,
    company_name: row.company_name,
    item: row.item,
    status: row.status,
    message: row.message,
  };
}

function statusRow(
  source: ParsedStructureRow,
  company: ResolvedCompany | null,
  parentCompanyId: number | null,
  status: ImportRowStatus,
  message: string,
): PlannedStructureRow {
  return {
    row: source.row,
    company_ref: company?.reference ?? source.companyReference,
    company_name: company?.name ?? "",
    item: source.parentReference ? `Parent: ${source.parentReference}` : "Root company",
    status,
    message,
    companyId: company?.company_id ?? null,
    parentCompanyId,
    currentParentCompanyId: company?.parent_company_id ?? null,
    settings: null,
  };
}

function buildReferenceIndex(companies: CompanySummary[]) {
  const byReference = new Map<string, ResolvedCompany>();
  const ambiguous = new Set<string>();

  companies.forEach((company) => {
    const reference = company.reference?.trim();
    if (!reference) return;
    const key = normalized(reference);
    if (byReference.has(key)) ambiguous.add(key);
    else byReference.set(key, { ...company, reference });
  });

  ambiguous.forEach((key) => byReference.delete(key));
  return { byReference, ambiguous };
}

function cycleFor(
  startId: number,
  parentById: Map<number, number | null>,
  visibleIds: Set<number>,
): number[] | null {
  const path: number[] = [];
  const positions = new Map<number, number>();
  let current: number | null | undefined = startId;

  while (current !== null && current !== undefined && visibleIds.has(current)) {
    const existing = positions.get(current);
    if (existing !== undefined) return [...path.slice(existing), current];
    positions.set(current, path.length);
    path.push(current);
    current = parentById.get(current) ?? null;
  }

  return null;
}

function finalDepth(
  companyId: number,
  parentById: Map<number, number | null>,
  visibleIds: Set<number>,
) {
  let depth = 0;
  let current = parentById.get(companyId) ?? null;
  const seen = new Set<number>([companyId]);

  while (current !== null && visibleIds.has(current) && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = parentById.get(current) ?? null;
  }

  return depth;
}

function preservedSettingsInput(settings: CompanySettings, parentCompanyId: number | null) {
  if (settings.customer_group_id === null) {
    throw new Error("Company has no customer group, so its parent cannot be changed safely through the bulk structure importer.");
  }

  return {
    company_id: settings.company_id,
    vat_tax_id: settings.vat_tax_id ?? "",
    customer_group_id: settings.customer_group_id,
    parent_company_id: parentCompanyId,
    comment: settings.comment ?? "",
    description: settings.description ?? "",
    homepage_content: settings.homepage_content ?? "",
    show_company_landing_page: settings.show_company_landing_page,
  };
}

async function planCompanyStructure(source: string) {
  const parsed = parseStructureCsv(source);
  const companies = await getAllCompanies();
  const { byReference, ambiguous } = buildReferenceIndex(companies);
  const byId = new Map(companies.map((company) => [company.company_id, company]));
  const visibleIds = new Set(byId.keys());
  const duplicateChildren = new Map<string, number>();

  parsed.forEach((row) => {
    const key = normalized(row.companyReference);
    if (key) duplicateChildren.set(key, (duplicateChildren.get(key) ?? 0) + 1);
  });

  const planned: PlannedStructureRow[] = [];
  const validRows = new Map<number, { source: ParsedStructureRow; company: ResolvedCompany; parent: ResolvedCompany | null }>();

  for (const sourceRow of parsed) {
    if (!sourceRow.companyReference) {
      planned.push(statusRow(sourceRow, null, null, "Error", "company_reference is required."));
      continue;
    }

    const childKey = normalized(sourceRow.companyReference);
    if ((duplicateChildren.get(childKey) ?? 0) > 1) {
      const company = byReference.get(childKey) ?? null;
      planned.push(statusRow(sourceRow, company, null, "Error", "company_reference appears more than once in this file."));
      continue;
    }
    if (ambiguous.has(childKey)) {
      planned.push(statusRow(sourceRow, null, null, "Error", "company_reference is ambiguous in the visible company scope."));
      continue;
    }

    const company = byReference.get(childKey) ?? null;
    if (!company) {
      planned.push(statusRow(sourceRow, null, null, "Error", "company_reference was not found in the visible company scope."));
      continue;
    }

    let parent: ResolvedCompany | null = null;
    if (sourceRow.parentReference) {
      const parentKey = normalized(sourceRow.parentReference);
      if (parentKey === childKey) {
        planned.push(statusRow(sourceRow, company, company.company_id, "Error", "A company cannot be its own parent."));
        continue;
      }
      if (ambiguous.has(parentKey)) {
        planned.push(statusRow(sourceRow, company, null, "Error", "parent_reference is ambiguous in the visible company scope."));
        continue;
      }
      parent = byReference.get(parentKey) ?? null;
      if (!parent) {
        planned.push(statusRow(sourceRow, company, null, "Error", "parent_reference was not found in the visible company scope."));
        continue;
      }
    }

    validRows.set(company.company_id, { source: sourceRow, company, parent });
  }

  const desiredParentById = new Map(companies.map((company) => [company.company_id, company.parent_company_id]));
  validRows.forEach(({ company, parent }) => desiredParentById.set(company.company_id, parent?.company_id ?? null));

  const cycleIds = new Set<number>();
  let cycleMessage = "";
  for (const companyId of validRows.keys()) {
    const cycle = cycleFor(companyId, desiredParentById, visibleIds);
    if (!cycle) continue;
    cycle.forEach((id) => cycleIds.add(id));
    if (!cycleMessage) {
      cycleMessage = cycle.map((id) => byId.get(id)?.reference || `Company ${id}`).join(" → ");
    }
  }

  for (const { source: sourceRow, company, parent } of validRows.values()) {
    if (cycleIds.has(company.company_id)) {
      planned.push(statusRow(
        sourceRow,
        company,
        parent?.company_id ?? null,
        "Error",
        `This change would create a company-structure cycle${cycleMessage ? `: ${cycleMessage}` : ""}.`,
      ));
      continue;
    }

    const desiredParentId = parent?.company_id ?? null;
    const currentParentId = company.parent_company_id;
    if (currentParentId === desiredParentId) {
      planned.push(statusRow(
        sourceRow,
        company,
        desiredParentId,
        "Skipped",
        parent ? `Parent is already ${parent.reference}.` : "Company is already a root company.",
      ));
      continue;
    }

    const row = statusRow(
      sourceRow,
      company,
      desiredParentId,
      "Updated",
      parent
        ? `Parent will be set to ${parent.reference}.`
        : currentParentId === null
          ? "Company is already a root company."
          : "Parent will be removed and the company will become a root.",
    );

    try {
      row.settings = await getCompanySettings(company.company_id);
      preservedSettingsInput(row.settings, desiredParentId);
    } catch (error) {
      row.status = "Error";
      row.message = error instanceof Error ? error.message : "Company settings could not be loaded for this structure change.";
    }

    planned.push(row);
  }

  planned.sort((a, b) => a.row - b.row);
  return { rows: planned, desiredParentById, visibleIds };
}

export async function previewCompanyStructureCsv(source: string) {
  return (await planCompanyStructure(source)).rows.map(publicRow);
}

export async function applyCompanyStructureCsv(source: string) {
  const plan = await planCompanyStructure(source);
  if (plan.rows.some((row) => row.status === "Error")) {
    throw new Error("Resolve every preview error before applying this company structure import.");
  }

  const actionable = plan.rows
    .filter((row) => row.status === "Updated")
    .sort((left, right) => {
      const leftDepth = finalDepth(left.companyId!, plan.desiredParentById, plan.visibleIds);
      const rightDepth = finalDepth(right.companyId!, plan.desiredParentById, plan.visibleIds);
      return leftDepth - rightDepth || left.row - right.row;
    });

  let stopped = false;
  for (const row of actionable) {
    if (stopped) {
      row.status = "Error";
      row.message = "Not applied because an earlier company-structure update failed. Preview the file again before retrying.";
      continue;
    }

    try {
      if (!row.settings) throw new Error("Company settings were not available for this update.");
      await updateCompanySettings(preservedSettingsInput(row.settings, row.parentCompanyId));
      row.message = row.parentCompanyId === null
        ? "Company parent removed; company is now a root."
        : `Company parent updated to ${row.item.replace(/^Parent:\s*/, "")}.`;
    } catch (error) {
      row.status = "Error";
      row.message = error instanceof Error ? error.message : "Backend rejected the company-structure update.";
      stopped = true;
    }
  }

  return plan.rows.map(publicRow);
}

export function exampleCompanyStructureCsv() {
  return csvWithBom([
    ["company_reference", "parent_reference"],
    ["MOR012", ""],
    ["MOR013", "MOR012"],
    ["MOR014", "MOR012"],
    ["MOR020", "MOR014"],
  ]);
}

export async function exportBulkCompanyStructureCsv() {
  const companies = await getAllCompanies();
  const { byReference, ambiguous } = buildReferenceIndex(companies);
  if (ambiguous.size) throw new Error("Company references are not unique in the visible company scope; structure export is unavailable.");

  const referenced = companies.map((company) => {
    const reference = company.reference?.trim();
    if (!reference) throw new Error(`Company ${company.company_id} has no company reference; structure export would be incomplete.`);
    return { ...company, reference } as ResolvedCompany;
  });
  const byId = new Map(referenced.map((company) => [company.company_id, company]));
  const rows: Array<Array<string | number>> = [["company_reference", "parent_reference"]];

  referenced
    .sort((a, b) => a.reference.localeCompare(b.reference, "en", { sensitivity: "base" }))
    .forEach((company) => {
      let parentReference = "";
      if (company.parent_company_id !== null) {
        const parent = byId.get(company.parent_company_id);
        if (!parent) {
          throw new Error(
            `Cannot safely export ${company.reference}: its parent company is outside the current visible admin scope.`,
          );
        }
        parentReference = parent.reference;
      }
      rows.push([company.reference, parentReference]);
    });

  // Make sure the reference index is used to validate every exported reference.
  referenced.forEach((company) => {
    if (!byReference.has(normalized(company.reference))) {
      throw new Error(`Company reference ${company.reference} could not be resolved uniquely.`);
    }
  });

  return csvWithBom(rows);
}

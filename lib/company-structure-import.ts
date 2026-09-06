import { parseCsv, stringifyCsv } from "@/lib/csv";
import { getCompanies, type CompanySummary } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { updateCompanyParent } from "@/lib/graphql/company-settings";
import type { FlatCompanyImportRow } from "@/lib/import-export-types";

const MAX_ROWS = 5000;
const HEADERS = ["company_reference", "parent_reference"] as const;

type ResolvedCompany = CompanySummary & { reference: string };

type PlannedStructureRow = FlatCompanyImportRow & {
  companyId: number | null;
  currentParentId: number | null;
  desiredParentId: number | null;
};

type ChangedStructureRow = PlannedStructureRow & { companyId: number };

type StructurePlan = {
  rows: PlannedStructureRow[];
  companies: ResolvedCompany[];
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function csvWithBom(rows: Array<Array<string | number>>) {
  return `\uFEFF${stringifyCsv(rows)}`;
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

function errorRow(row: number, companyRef: string, item: string, message: string): PlannedStructureRow {
  return {
    row,
    company_ref: companyRef,
    company_name: "",
    item,
    status: "Error",
    message,
    companyId: null,
    currentParentId: null,
    desiredParentId: null,
  };
}

function parseStructureCsv(source: string) {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The CSV file is empty.");
  if (rows.length - 1 > MAX_ROWS) {
    throw new Error(`CSV import is limited to ${MAX_ROWS.toLocaleString()} data rows per preview.`);
  }

  const headers = rows[0].map(normalized);
  if (
    headers.length !== HEADERS.length
    || headers.some((header, index) => header !== HEADERS[index])
    || new Set(headers).size !== headers.length
  ) {
    throw new Error(`CSV headers must be exactly: ${HEADERS.join(", ")}.`);
  }
  if (rows.length === 1) throw new Error("The CSV file contains no data rows.");

  return rows.slice(1).map((row, index) => ({
    row: index + 2,
    companyReference: row[0]?.trim() ?? "",
    parentReference: row[1]?.trim() ?? "",
  }));
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

function referencedCompanies(companies: CompanySummary[]) {
  return companies
    .filter((company): company is ResolvedCompany => Boolean(company.reference?.trim()))
    .map((company) => ({ ...company, reference: company.reference!.trim() }));
}

function referenceIndex(companies: ResolvedCompany[]) {
  const byRef = new Map<string, ResolvedCompany>();
  const duplicates = new Set<string>();

  for (const company of companies) {
    const key = normalized(company.reference);
    if (byRef.has(key)) duplicates.add(key);
    else byRef.set(key, company);
  }

  for (const key of duplicates) byRef.delete(key);
  return { byRef, duplicates };
}

function parentLabel(parentId: number | null, byId: Map<number, ResolvedCompany>) {
  if (parentId === null) return "root";
  const parent = byId.get(parentId);
  return parent?.reference ?? `company #${parentId} outside visible scope`;
}

function cycleCompanyIds(parentById: Map<number, number | null>) {
  const cycleIds = new Set<number>();

  for (const startId of parentById.keys()) {
    const path: number[] = [];
    const indexById = new Map<number, number>();
    let currentId: number | null = startId;

    while (currentId !== null && parentById.has(currentId)) {
      const cycleStart = indexById.get(currentId);
      if (cycleStart !== undefined) {
        path.slice(cycleStart).forEach((id) => cycleIds.add(id));
        break;
      }
      indexById.set(currentId, path.length);
      path.push(currentId);
      currentId = parentById.get(currentId) ?? null;
    }
  }

  return cycleIds;
}

async function planCompanyStructureCsv(source: string): Promise<StructurePlan> {
  const inputRows = parseStructureCsv(source);
  const allCompanies = await getAllCompanies();
  const companies = referencedCompanies(allCompanies);
  const { byRef, duplicates: duplicateDatabaseRefs } = referenceIndex(companies);
  const byId = new Map(companies.map((company) => [company.company_id, company]));
  const csvRefCounts = new Map<string, number>();

  for (const input of inputRows) {
    const key = normalized(input.companyReference);
    if (key) csvRefCounts.set(key, (csvRefCounts.get(key) ?? 0) + 1);
  }

  const rows: PlannedStructureRow[] = inputRows.map((input) => {
    const companyKey = normalized(input.companyReference);
    const parentKey = normalized(input.parentReference);
    const item = `${input.companyReference || "(blank)"} → ${input.parentReference || "root"}`;

    if (!input.companyReference) {
      return errorRow(input.row, "", item, "company_reference is required.");
    }
    if ((csvRefCounts.get(companyKey) ?? 0) > 1) {
      return errorRow(
        input.row,
        input.companyReference,
        item,
        "company_reference appears more than once in this CSV. Each company may have only one parent assignment per import.",
      );
    }
    if (duplicateDatabaseRefs.has(companyKey)) {
      return errorRow(
        input.row,
        input.companyReference,
        item,
        "The company reference is not unique in the visible Magento company set.",
      );
    }

    const company = byRef.get(companyKey);
    if (!company) {
      return errorRow(
        input.row,
        input.companyReference,
        item,
        "Company reference was not found in the current admin scope.",
      );
    }

    let parent: ResolvedCompany | null = null;
    if (input.parentReference) {
      if (duplicateDatabaseRefs.has(parentKey)) {
        return errorRow(
          input.row,
          company.reference,
          item,
          "parent_reference is not unique in the visible Magento company set.",
        );
      }
      parent = byRef.get(parentKey) ?? null;
      if (!parent) {
        return errorRow(
          input.row,
          company.reference,
          item,
          "Parent reference was not found in the current admin scope.",
        );
      }
      if (parent.company_id === company.company_id) {
        return errorRow(input.row, company.reference, item, "A company cannot be its own parent.");
      }
    }

    const desiredParentId = parent?.company_id ?? null;
    const currentParentId = company.parent_company_id;
    const currentLabel = parentLabel(currentParentId, byId);
    const desiredLabel = parent?.reference ?? "root";
    const changed = currentParentId !== desiredParentId;

    return {
      row: input.row,
      company_ref: company.reference,
      company_name: company.name,
      item: `${company.reference} → ${desiredLabel}`,
      status: changed ? "Updated" : "Skipped",
      message: changed
        ? `Parent will change from ${currentLabel} to ${desiredLabel}.`
        : `Parent is already ${desiredLabel}; no change required.`,
      companyId: company.company_id,
      currentParentId,
      desiredParentId,
    };
  });

  const proposedParents = new Map<number, number | null>(
    companies.map((company) => [company.company_id, company.parent_company_id]),
  );
  for (const row of rows) {
    if (row.status !== "Error" && row.companyId !== null) {
      proposedParents.set(row.companyId, row.desiredParentId);
    }
  }

  const cycles = cycleCompanyIds(proposedParents);
  if (cycles.size) {
    for (const row of rows) {
      if (row.companyId !== null && cycles.has(row.companyId)) {
        row.status = "Error";
        row.message = "This assignment would create or preserve a cycle in the visible company hierarchy. Remove the circular parent relationship before applying.";
      }
    }
  }

  return { rows, companies };
}

export async function previewCompanyStructureCsv(source: string) {
  const plan = await planCompanyStructureCsv(source);
  return plan.rows.map(publicRow);
}

function changedRows(plan: StructurePlan): ChangedStructureRow[] {
  return plan.rows.filter(
    (row): row is ChangedStructureRow => row.status === "Updated" && row.companyId !== null,
  );
}

export async function applyCompanyStructureCsv(source: string) {
  const plan = await planCompanyStructureCsv(source);
  if (plan.rows.some((row) => row.status === "Error")) return plan.rows.map(publicRow);

  const changed = changedRows(plan);
  const resultByRow = new Map(plan.rows.map((row) => [row.row, { ...row }]));
  const byId = new Map(plan.companies.map((company) => [company.company_id, company]));
  const detached: ChangedStructureRow[] = [];
  const detachFailures: ChangedStructureRow[] = [];

  // Detach moved branches first so the attachment phase cannot create a transient hierarchy cycle.
  for (const row of changed) {
    if (row.currentParentId === null) continue;
    try {
      await updateCompanyParent(row.companyId, null);
      detached.push(row);
    } catch (error) {
      detachFailures.push(row);
      const result = resultByRow.get(row.row)!;
      result.status = "Error";
      result.message = `Could not detach the existing parent: ${graphQLErrorMessage(error)}`;
    }
  }

  if (detachFailures.length) {
    // Do not create any new parent edges if the detach phase was incomplete. Restore prior edges best-effort.
    const rollbackFailures = new Set<number>();
    for (const row of [...detached].reverse()) {
      try {
        await updateCompanyParent(row.companyId, row.currentParentId);
      } catch (error) {
        rollbackFailures.add(row.companyId);
        const result = resultByRow.get(row.row)!;
        result.status = "Error";
        result.message = `The structure apply stopped after another detach failed, and restoring the original parent also failed: ${graphQLErrorMessage(error)}`;
      }
    }

    for (const row of changed) {
      if (detachFailures.some((failed) => failed.companyId === row.companyId) || rollbackFailures.has(row.companyId)) {
        continue;
      }
      const result = resultByRow.get(row.row)!;
      result.status = "Error";
      result.message = row.currentParentId === null
        ? "No change was applied because another required parent detach failed. Re-preview the structure before retrying."
        : "The original parent was restored because another required detach failed. Re-preview the structure before retrying.";
    }

    return [...resultByRow.values()].sort((left, right) => left.row - right.row).map(publicRow);
  }

  const attachmentFailures = new Set<number>();

  // Attach requested parents only after every required detach succeeded.
  for (const row of changed) {
    if (row.desiredParentId === null) continue;
    try {
      await updateCompanyParent(row.companyId, row.desiredParentId);
    } catch (error) {
      attachmentFailures.add(row.companyId);
      const result = resultByRow.get(row.row)!;
      result.status = "Error";
      result.message = row.currentParentId === null
        ? `Could not assign the requested parent: ${graphQLErrorMessage(error)}`
        : `The old parent was detached, but the requested parent could not be assigned: ${graphQLErrorMessage(error)}`;
    }
  }

  for (const row of changed) {
    if (attachmentFailures.has(row.companyId)) continue;
    const result = resultByRow.get(row.row)!;
    result.status = "Updated";
    result.message = row.desiredParentId === null
      ? "Company is now a root company with no parent."
      : `Parent relationship updated to ${parentLabel(row.desiredParentId, byId)}.`;
  }

  return [...resultByRow.values()].sort((left, right) => left.row - right.row).map(publicRow);
}

export async function exportBulkCompanyStructureCsv() {
  const allCompanies = await getAllCompanies();
  const companies = referencedCompanies(allCompanies);
  if (!companies.length) {
    throw new Error("No companies with references are available for company-structure export.");
  }

  const { duplicates } = referenceIndex(companies);
  if (duplicates.size) {
    throw new Error("Cannot safely export company structure because company references are not unique in the current admin scope.");
  }

  const byId = new Map(companies.map((company) => [company.company_id, company]));
  const rows: Array<Array<string | number>> = [[...HEADERS]];

  for (const company of companies.sort((left, right) => left.reference.localeCompare(right.reference))) {
    if (company.parent_company_id === null) {
      rows.push([company.reference, ""]);
      continue;
    }

    const parent = byId.get(company.parent_company_id);
    if (!parent) {
      throw new Error(
        `Cannot safely export the complete structure: ${company.reference} has parent company #${company.parent_company_id}, which is outside the current admin scope or has no reference.`,
      );
    }
    rows.push([company.reference, parent.reference]);
  }

  return csvWithBom(rows);
}

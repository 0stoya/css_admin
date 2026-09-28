import { parseCsv, stringifyCsv } from "@/lib/csv";
import { getAllCompanies, type CompanySummary } from "@/lib/graphql/companies";
import {
  getAdminCompanyPresentation,
  saveAdminCompanyPresentation,
} from "@/lib/graphql/company-presentation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import type { FlatCompanyImportRow } from "@/lib/import-export-types";

const HEADERS = ["company_ref", "company_name", "company_description"] as const;
const MAX_ROWS = 5000;
const MAX_DESCRIPTION_LENGTH = 20000;
const CONCURRENCY = 8;

type ResolvedCompany = CompanySummary & { reference: string };

type PlannedRow = {
  public: FlatCompanyImportRow;
  companyId: number | null;
  desiredDescription: string;
};

function normalise(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function csvWithBom(rows: Array<Array<string | number>>) {
  return `\uFEFF${stringifyCsv(rows)}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await work(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker()),
  );
  return results;
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
    const key = normalise(company.reference);
    if (byRef.has(key)) duplicates.add(key);
    else byRef.set(key, company);
  }

  for (const key of duplicates) byRef.delete(key);
  return { byRef, duplicates };
}

function parseDescriptionCsv(source: string) {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The CSV file is empty.");
  if (rows.length - 1 > MAX_ROWS) {
    throw new Error(`CSV import is limited to ${MAX_ROWS.toLocaleString()} data rows per preview.`);
  }

  const headers = rows[0].map(normalise);
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
    companyRef: row[0]?.trim() ?? "",
    companyName: row[1]?.trim() ?? "",
    description: row[2]?.trim() ?? "",
  }));
}

async function plan(source: string) {
  const inputRows = parseDescriptionCsv(source);
  const companies = referencedCompanies(await getAllCompanies());
  const { byRef, duplicates: duplicateDatabaseRefs } = referenceIndex(companies);

  const csvCounts = new Map<string, number>();
  for (const input of inputRows) {
    const key = normalise(input.companyRef);
    if (key) csvCounts.set(key, (csvCounts.get(key) ?? 0) + 1);
  }

  const resolved = await mapWithConcurrency(inputRows, CONCURRENCY, async (input): Promise<PlannedRow> => {
    const key = normalise(input.companyRef);
    const item = "Company description";

    if (!input.companyRef) {
      return {
        public: {
          row: input.row,
          company_ref: "",
          company_name: input.companyName,
          item,
          status: "Error" as const,
          message: "company_ref is required.",
        },
        companyId: null,
        desiredDescription: input.description,
      };
    }

    if ((csvCounts.get(key) ?? 0) > 1) {
      return {
        public: {
          row: input.row,
          company_ref: input.companyRef,
          company_name: input.companyName,
          item,
          status: "Error" as const,
          message: "company_ref appears more than once in this CSV.",
        },
        companyId: null,
        desiredDescription: input.description,
      };
    }

    if (duplicateDatabaseRefs.has(key)) {
      return {
        public: {
          row: input.row,
          company_ref: input.companyRef,
          company_name: input.companyName,
          item,
          status: "Error" as const,
          message: "The company reference is not unique in the visible Magento company set.",
        },
        companyId: null,
        desiredDescription: input.description,
      };
    }

    const company = byRef.get(key);
    if (!company) {
      return {
        public: {
          row: input.row,
          company_ref: input.companyRef,
          company_name: input.companyName,
          item,
          status: "Error" as const,
          message: "Company reference was not found in the current admin scope.",
        },
        companyId: null,
        desiredDescription: input.description,
      };
    }

    if (input.description.length > MAX_DESCRIPTION_LENGTH) {
      return {
        public: {
          row: input.row,
          company_ref: company.reference,
          company_name: company.name,
          item,
          status: "Error" as const,
          message: `company_description exceeds ${MAX_DESCRIPTION_LENGTH.toLocaleString()} characters.`,
        },
        companyId: company.company_id,
        desiredDescription: input.description,
      };
    }

    try {
      const presentation = await getAdminCompanyPresentation(company.company_id);
      const currentDescription = presentation.company_description ?? "";
      const changed = currentDescription !== input.description;

      return {
        public: {
          row: input.row,
          company_ref: company.reference,
          company_name: company.name,
          item,
          status: changed ? "Updated" as const : "Skipped" as const,
          message: changed
            ? input.description
              ? "Company description will be updated."
              : "Company description will be cleared."
            : "Company description is already unchanged.",
        },
        companyId: company.company_id,
        desiredDescription: input.description,
      };
    } catch (error) {
      return {
        public: {
          row: input.row,
          company_ref: company.reference,
          company_name: company.name,
          item,
          status: "Error" as const,
          message: `Could not read current description: ${graphQLErrorMessage(error)}`,
        },
        companyId: company.company_id,
        desiredDescription: input.description,
      };
    }
  });

  return resolved;
}

export async function previewCompanyDescriptionsCsv(source: string) {
  return (await plan(source)).map((row) => row.public);
}

export async function applyCompanyDescriptionsCsv(source: string) {
  const rows = await plan(source);
  if (rows.some((row) => row.public.status === "Error")) {
    return rows.map((row) => row.public);
  }

  await mapWithConcurrency(
    rows.filter((row) => row.public.status === "Updated" && row.companyId !== null),
    CONCURRENCY,
    async (row) => {
      try {
        await saveAdminCompanyPresentation(row.companyId!, {
          company_description: row.desiredDescription || null,
        });
        row.public.status = "Updated";
        row.public.message = row.desiredDescription
          ? "Company description updated."
          : "Company description cleared.";
      } catch (error) {
        row.public.status = "Error";
        row.public.message = `Could not save company description: ${graphQLErrorMessage(error)}`;
      }
    },
  );

  return rows.map((row) => row.public);
}

export async function exportBulkCompanyDescriptionsCsv() {
  const companies = referencedCompanies(await getAllCompanies());
  if (!companies.length) {
    throw new Error("No companies with references are available for company-description export.");
  }

  const { duplicates } = referenceIndex(companies);
  if (duplicates.size) {
    throw new Error("Cannot safely export company descriptions because company references are not unique in the current admin scope.");
  }

  const sorted = [...companies].sort((left, right) => left.reference.localeCompare(right.reference));
  const descriptions = await mapWithConcurrency(sorted, CONCURRENCY, async (company) => {
    const presentation = await getAdminCompanyPresentation(company.company_id);
    return presentation.company_description ?? "";
  });

  const rows: Array<Array<string | number>> = [[...HEADERS]];
  sorted.forEach((company, index) => {
    rows.push([company.reference, company.name, descriptions[index]]);
  });
  return csvWithBom(rows);
}

export function companyDescriptionExampleCsv() {
  return csvWithBom([
    [...HEADERS],
    ["CEM007", "CEMEX UK Materials Ltd", "Example company description."],
    ["BIO002", "BioMarsh", ""],
  ]);
}

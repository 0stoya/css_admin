"use server";

import { revalidatePath } from "next/cache";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  applyCompanyProductsCsv,
  applyCompanyUsersFlatCsv,
  applyRoleProductsCsv,
  applyRolesPermissionsCsv,
  previewCompanyProductsCsv,
  previewCompanyUsersFlatCsv,
  previewRoleProductsCsv,
  previewRolesPermissionsCsv,
} from "@/lib/flat-company-imports";
import type { FlatCompanyImportState } from "@/lib/import-export-types";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Runner = (source: string, companyId: number, apply: boolean, createMissingRoles: boolean) => Promise<FlatCompanyImportState["rows"]>;

function requiredCompanyId(formData: FormData) {
  const raw = String(formData.get("companyId") ?? "").trim();
  const companyId = Number(raw);
  if (!raw || !Number.isInteger(companyId) || companyId <= 0) throw new Error("companyId must be a positive integer.");
  return companyId;
}

async function sourceCsv(formData: FormData, intent: string) {
  if (intent === "apply") {
    const source = String(formData.get("sourceCsv") ?? "");
    if (!source.trim()) throw new Error("CSV source is required.");
    return source;
  }
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) throw new Error("Choose a CSV file to preview.");
  if (value.size > MAX_FILE_BYTES) throw new Error("CSV files are limited to 2 MB.");
  return value.text();
}

async function runFlatImport(
  previous: FlatCompanyImportState,
  formData: FormData,
  runner: Runner,
  revalidate: (companyId: number) => string[],
): Promise<FlatCompanyImportState> {
  let source = previous.sourceCsv;
  const createMissingRoles = formData.get("createMissingRoles") === "true";
  try {
    const companyId = requiredCompanyId(formData);
    const intent = String(formData.get("intent") ?? "preview") === "apply" ? "apply" : "preview";
    source = await sourceCsv(formData, intent);
    if (new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) throw new Error("CSV files are limited to 2 MB.");
    const rows = await runner(source, companyId, intent === "apply", createMissingRoles);
    if (intent === "apply") revalidate(companyId).forEach((path) => revalidatePath(path));
    return { phase: intent === "apply" ? "applied" : "preview", sourceCsv: source, rows, create_missing_roles: createMissingRoles, error: null };
  } catch (error) {
    return { phase: "error", sourceCsv: source, rows: [], create_missing_roles: createMissingRoles, error: graphQLErrorMessage(error) };
  }
}

export async function companyUsersFlatImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runFlatImport(
    previous,
    formData,
    (source, companyId, apply) => apply
      ? applyCompanyUsersFlatCsv(source, { lockedCompanyId: companyId })
      : previewCompanyUsersFlatCsv(source, { lockedCompanyId: companyId }),
    (companyId) => [`/companies/${companyId}/management`, `/companies/${companyId}/import-export`],
  );
}

export async function companyRolesFlatImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runFlatImport(
    previous,
    formData,
    (source, companyId, apply, createMissingRoles) => apply
      ? applyRolesPermissionsCsv(source, { lockedCompanyId: companyId, createMissingRoles })
      : previewRolesPermissionsCsv(source, { lockedCompanyId: companyId, createMissingRoles }),
    (companyId) => [`/companies/${companyId}/management`, `/companies/${companyId}/import-export`],
  );
}

export async function companyRoleProductsFlatImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runFlatImport(
    previous,
    formData,
    (source, companyId, apply) => apply
      ? applyRoleProductsCsv(source, { lockedCompanyId: companyId })
      : previewRoleProductsCsv(source, { lockedCompanyId: companyId }),
    (companyId) => [`/companies/${companyId}/catalog`, `/companies/${companyId}/import-export`],
  );
}

export async function companyProductsFlatImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runFlatImport(
    previous,
    formData,
    (source, companyId, apply) => apply
      ? applyCompanyProductsCsv(source, { lockedCompanyId: companyId })
      : previewCompanyProductsCsv(source, { lockedCompanyId: companyId }),
    (companyId) => [`/companies/${companyId}/catalog`, `/companies/${companyId}/import-export`],
  );
}

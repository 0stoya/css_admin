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
import {
  applyCompanyStructureCsv,
  previewCompanyStructureCsv,
} from "@/lib/company-structure-import";
import type { FlatCompanyImportState } from "@/lib/import-export-types";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
type Runner = (source: string, apply: boolean, createMissingRoles: boolean) => Promise<FlatCompanyImportState["rows"]>;

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

async function runBulkImport(previous: FlatCompanyImportState, formData: FormData, runner: Runner) {
  let source = previous.sourceCsv;
  const createMissingRoles = formData.get("createMissingRoles") === "true";
  try {
    const intent = String(formData.get("intent") ?? "preview") === "apply" ? "apply" : "preview";
    source = await sourceCsv(formData, intent);
    if (new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) throw new Error("CSV files are limited to 2 MB.");
    const rows = await runner(source, intent === "apply", createMissingRoles);
    if (intent === "apply") {
      revalidatePath("/companies");
      revalidatePath("/bulk-import");
    }
    return { phase: intent === "apply" ? "applied" : "preview", sourceCsv: source, rows, create_missing_roles: createMissingRoles, error: null } satisfies FlatCompanyImportState;
  } catch (error) {
    return { phase: "error", sourceCsv: source, rows: [], create_missing_roles: createMissingRoles, error: graphQLErrorMessage(error) } satisfies FlatCompanyImportState;
  }
}

export async function bulkUsersImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply ? applyCompanyUsersFlatCsv(source) : previewCompanyUsersFlatCsv(source));
}

export async function bulkRolesImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply, createMissingRoles) => apply
    ? applyRolesPermissionsCsv(source, { createMissingRoles })
    : previewRolesPermissionsCsv(source, { createMissingRoles }));
}

export async function bulkRoleProductsImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply ? applyRoleProductsCsv(source) : previewRoleProductsCsv(source));
}

export async function bulkCompanyProductsImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply ? applyCompanyProductsCsv(source) : previewCompanyProductsCsv(source));
}

export async function bulkCompanyStructureImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply ? applyCompanyStructureCsv(source) : previewCompanyStructureCsv(source));
}

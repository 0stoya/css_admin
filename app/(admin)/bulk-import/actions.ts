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
  applyBulkPurchaseControlsCsv,
  previewBulkPurchaseControlsCsv,
} from "@/lib/bulk-purchase-controls";
import {
  applyCompanyStructureCsv,
  previewCompanyStructureCsv,
} from "@/lib/company-structure-import";
import type { FlatCompanyImportState } from "@/lib/import-export-types";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type RunnerOptions = {
  createMissingRoles: boolean;
  createMissingTemplates: boolean;
  applyPurchaseTemplates: boolean;
  onlyCompanyRefs?: string[];
};

type Runner = (
  source: string,
  apply: boolean,
  options: RunnerOptions,
) => Promise<FlatCompanyImportState["rows"]>;

type ImportIntent = "preview" | "apply" | "retry";

function importIntent(formData: FormData): ImportIntent {
  const value = String(formData.get("intent") ?? "preview");
  if (value === "apply" || value === "retry") return value;
  return "preview";
}

async function sourceCsv(formData: FormData, intent: ImportIntent) {
  if (intent !== "preview") {
    const source = String(formData.get("sourceCsv") ?? "");
    if (!source.trim()) throw new Error("CSV source is required.");
    return source;
  }
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) throw new Error("Choose a CSV file to preview.");
  if (value.size > MAX_FILE_BYTES) throw new Error("CSV files are limited to 2 MB.");
  return value.text();
}

function retryCompanyRefs(formData: FormData, intent: ImportIntent) {
  if (intent !== "retry") return undefined;
  const raw = String(formData.get("retryCompanyRefs") ?? "").trim();
  if (!raw) throw new Error("Retry requires at least one failed company reference.");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Retry company references are invalid.");
  const refs = [...new Set(parsed.map((value) => String(value).trim()).filter(Boolean))];
  if (!refs.length) throw new Error("Retry requires at least one failed company reference.");
  return refs;
}

async function runBulkImport(previous: FlatCompanyImportState, formData: FormData, runner: Runner) {
  let source = previous.sourceCsv;
  const createMissingRoles = formData.get("createMissingRoles") === "true";
  const createMissingTemplates = formData.get("createMissingTemplates") === "true";
  const applyPurchaseTemplates = formData.get("applyPurchaseTemplates") === "true";

  try {
    const intent = importIntent(formData);
    source = await sourceCsv(formData, intent);
    if (new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) throw new Error("CSV files are limited to 2 MB.");

    const rows = await runner(source, intent !== "preview", {
      createMissingRoles,
      createMissingTemplates,
      applyPurchaseTemplates,
      onlyCompanyRefs: retryCompanyRefs(formData, intent),
    });

    if (intent !== "preview") {
      revalidatePath("/companies");
      revalidatePath("/bulk-import");
    }

    return {
      phase: intent === "preview" ? "preview" : "applied",
      sourceCsv: source,
      rows,
      create_missing_roles: createMissingRoles,
      create_missing_templates: createMissingTemplates,
      apply_purchase_templates: applyPurchaseTemplates,
      error: null,
    } satisfies FlatCompanyImportState;
  } catch (error) {
    return {
      phase: "error",
      sourceCsv: source,
      rows: [],
      create_missing_roles: createMissingRoles,
      create_missing_templates: createMissingTemplates,
      apply_purchase_templates: applyPurchaseTemplates,
      error: graphQLErrorMessage(error),
    } satisfies FlatCompanyImportState;
  }
}

export async function bulkUsersImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply
    ? applyCompanyUsersFlatCsv(source)
    : previewCompanyUsersFlatCsv(source));
}

export async function bulkRolesImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply, options) => apply
    ? applyRolesPermissionsCsv(source, { createMissingRoles: options.createMissingRoles })
    : previewRolesPermissionsCsv(source, { createMissingRoles: options.createMissingRoles }));
}

export async function bulkRoleProductsImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply
    ? applyRoleProductsCsv(source)
    : previewRoleProductsCsv(source));
}

export async function bulkCompanyProductsImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply
    ? applyCompanyProductsCsv(source)
    : previewCompanyProductsCsv(source));
}

export async function bulkPurchaseControlsImportAction(previous: FlatCompanyImportState, formData: FormData) {
  const intent = importIntent(formData);
  if (intent === "apply" && formData.get("confirmApply") !== "true") {
    return {
      ...previous,
      phase: "error",
      error: "Confirm that you reviewed the purchase-control changes before applying them.",
    } satisfies FlatCompanyImportState;
  }

  return runBulkImport(previous, formData, (source, apply, options) => {
    const purchaseOptions = {
      createMissingTemplates: options.createMissingTemplates,
      applyPurchaseTemplates: options.applyPurchaseTemplates,
      onlyCompanyRefs: options.onlyCompanyRefs,
    };
    return apply
      ? applyBulkPurchaseControlsCsv(source, purchaseOptions)
      : previewBulkPurchaseControlsCsv(source, purchaseOptions);
  });
}

export async function bulkCompanyStructureImportAction(previous: FlatCompanyImportState, formData: FormData) {
  const intent = importIntent(formData);
  if (intent === "apply" && formData.get("confirmApply") !== "true") {
    return {
      ...previous,
      phase: "error",
      error: "Confirm that you reviewed the proposed company hierarchy before applying structure changes.",
    } satisfies FlatCompanyImportState;
  }

  return runBulkImport(previous, formData, (source, apply) => apply
    ? applyCompanyStructureCsv(source)
    : previewCompanyStructureCsv(source));
}

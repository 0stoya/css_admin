"use server";

import { revalidatePath } from "next/cache";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  readStagedBulkImportCsv,
  stageBulkImportCsv,
} from "@/lib/bulk-import-staging";
import {
  applyCompanyProductsCsv,
  applyCompanyUsersFlatCsv,
  applyRoleProductsCsv,
  previewCompanyProductsCsv,
  previewCompanyUsersFlatCsv,
  previewRoleProductsCsv,
} from "@/lib/flat-company-imports";
import {
  applyRolesPermissionsCsv,
  previewRolesPermissionsCsv,
} from "@/lib/role-permissions-imports";
import {
  applyBulkPurchaseControlsCsv,
  previewBulkPurchaseControlsCsv,
} from "@/lib/bulk-purchase-controls-direct";
import {
  applyCompanyStructureCsv,
  previewCompanyStructureCsv,
} from "@/lib/company-structure-import";
import type { FlatCompanyImportState } from "@/lib/import-export-types";
import {
  applyCompanyDescriptionsCsv,
  previewCompanyDescriptionsCsv,
} from "@/lib/company-description-import";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

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
    const token = String(formData.get("sourceToken") ?? "").trim();
    if (token) {
      return {
        source: await readStagedBulkImportCsv(token),
        sourceToken: token,
      };
    }

    // Compatibility for a stale page rendered by the previous deployment.
    const legacySource = String(formData.get("sourceCsv") ?? "");
    if (!legacySource.trim()) {
      throw new Error("Bulk import preview expired. Preview the CSV again.");
    }
    return { source: legacySource, sourceToken: "" };
  }

  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) {
    throw new Error("Choose a CSV file to preview.");
  }
  if (value.size > MAX_FILE_BYTES) {
    throw new Error("CSV files are limited to 10 MB.");
  }
  return { source: await value.text(), sourceToken: "" };
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

function mergeRetryRows(
  previousRows: FlatCompanyImportState["rows"],
  retryRows: FlatCompanyImportState["rows"],
  refs: string[] | undefined,
) {
  if (!refs?.length) return retryRows;
  const selected = new Set(refs.map((ref) => ref.trim().toLocaleLowerCase("en")));
  return [
    ...previousRows.filter((row) => !selected.has(row.company_ref.trim().toLocaleLowerCase("en"))),
    ...retryRows,
  ].sort((left, right) => left.row - right.row || left.company_ref.localeCompare(right.company_ref));
}

async function runBulkImport(previous: FlatCompanyImportState, formData: FormData, runner: Runner) {
  let source = "";
  let sourceToken = previous.sourceToken ?? "";
  const createMissingRoles = formData.get("createMissingRoles") === "true";
  const createMissingTemplates = formData.get("createMissingTemplates") === "true";
  const applyPurchaseTemplates = formData.get("applyPurchaseTemplates") === "true";

  try {
    const intent = importIntent(formData);
    const loaded = await sourceCsv(formData, intent);
    source = loaded.source;
    sourceToken = loaded.sourceToken;
    if (new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) {
      throw new Error("CSV files are limited to 10 MB.");
    }

    const onlyCompanyRefs = retryCompanyRefs(formData, intent);
    const resultRows = await runner(source, intent !== "preview", {
      createMissingRoles,
      createMissingTemplates,
      applyPurchaseTemplates,
      onlyCompanyRefs,
    });
    const rows = intent === "retry"
      ? mergeRetryRows(previous.rows, resultRows, onlyCompanyRefs)
      : resultRows;

    if (intent === "preview") {
      sourceToken = await stageBulkImportCsv(source);
    }

    if (intent !== "preview") {
      revalidatePath("/companies");
      revalidatePath("/bulk-import");
    }

    return {
      phase: intent === "preview" ? "preview" : "applied",
      sourceCsv: "",
      sourceToken,
      rows,
      create_missing_roles: createMissingRoles,
      create_missing_templates: createMissingTemplates,
      apply_purchase_templates: applyPurchaseTemplates,
      error: null,
    } satisfies FlatCompanyImportState;
  } catch (error) {
    return {
      phase: "error",
      sourceCsv: "",
      sourceToken,
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


export async function bulkCompanyDescriptionsImportAction(previous: FlatCompanyImportState, formData: FormData) {
  return runBulkImport(previous, formData, (source, apply) => apply
    ? applyCompanyDescriptionsCsv(source)
    : previewCompanyDescriptionsCsv(source));
}

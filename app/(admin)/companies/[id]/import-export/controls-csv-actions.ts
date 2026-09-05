"use server";

import { revalidatePath } from "next/cache";
import { parseCompanyControlsCsv } from "@/lib/company-controls-csv";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyControlsBundle,
  importCompanyControls,
  type CompanyControlsBundle,
  type CompanyControlsImportInput,
} from "@/lib/graphql/company-controls";
import type {
  CompanyControlsCsvImportState,
  CompanyControlsImportOptions,
} from "@/lib/import-export-types";

const MAX_FILE_BYTES = 512 * 1024;

function requiredCompanyId(formData: FormData) {
  const raw = String(formData.get("companyId") ?? "").trim();
  const companyId = Number(raw);
  if (!raw || !Number.isInteger(companyId) || companyId <= 0) {
    throw new Error("companyId must be a positive integer.");
  }
  return companyId;
}

async function uploadedText(formData: FormData, key: string, label: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) throw new Error(`Choose a ${label} file to preview.`);
  if (value.size > MAX_FILE_BYTES) throw new Error(`${label} files are limited to 512 KB.`);
  return value.text();
}

function validateSourceSize(source: string, label: string) {
  if (new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) {
    throw new Error(`${label} files are limited to 512 KB.`);
  }
}

function controlsOptions(formData: FormData): CompanyControlsImportOptions {
  return {
    create_missing_roles: formData.get("createMissingRoles") === "true",
    create_missing_templates: formData.get("createMissingTemplates") === "true",
    apply_purchase_templates: formData.get("applyPurchaseTemplates") === "true",
  };
}

function controlsInput(
  bundle: CompanyControlsBundle,
  options: CompanyControlsImportOptions,
  dryRun: boolean,
): CompanyControlsImportInput {
  return { ...bundle, ...options, dry_run: dryRun };
}

export async function companyControlsCsvImportAction(
  _previousState: CompanyControlsCsvImportState,
  formData: FormData,
): Promise<CompanyControlsCsvImportState> {
  let sourceCsv = String(formData.get("sourceCsv") ?? "");
  const options = controlsOptions(formData);

  try {
    const companyId = requiredCompanyId(formData);
    const intent = String(formData.get("intent") ?? "preview");
    if (intent === "preview") sourceCsv = await uploadedText(formData, "file", "CSV");
    if (!sourceCsv.trim()) throw new Error("Controls CSV source is required.");
    validateSourceSize(sourceCsv, "CSV");

    const targetBundle = await getCompanyControlsBundle(companyId);
    const { bundle, sourceCompanyId } = parseCompanyControlsCsv(sourceCsv, companyId, targetBundle);
    const dryRun = await importCompanyControls(controlsInput(bundle, options, true));
    if (!dryRun.valid) throw new Error("Fluid did not accept the company-controls dry run.");

    const result = intent === "apply"
      ? await importCompanyControls(controlsInput(bundle, options, false))
      : dryRun;

    if (intent === "apply") {
      revalidatePath(`/companies/${companyId}/management`);
      revalidatePath(`/companies/${companyId}/catalog`);
      revalidatePath(`/companies/${companyId}/purchase-controls`);
      revalidatePath(`/companies/${companyId}/import-export`);
    }

    return {
      phase: intent === "apply" ? "applied" : "preview",
      sourceCsv,
      sourceCompanyId,
      options,
      result,
      error: null,
    };
  } catch (error) {
    return {
      phase: "error",
      sourceCsv,
      sourceCompanyId: null,
      options,
      result: null,
      error: graphQLErrorMessage(error),
    };
  }
}

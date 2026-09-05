"use server";

import { revalidatePath } from "next/cache";
import { applyCompanyUserImport, previewCompanyUserImport } from "@/lib/company-user-import";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  importCompanyControls,
  type CompanyControlsBundle,
  type CompanyControlsImportInput,
} from "@/lib/graphql/company-controls";
import type {
  CompanyControlsImportOptions,
  CompanyControlsImportState,
  CompanyUserImportState,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseControlsBundle(source: string, companyId: number) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("The controls file is not valid JSON.");
  }

  if (!isRecord(parsed)) throw new Error("The controls JSON root must be an object.");
  if (typeof parsed.format !== "string" || !Number.isInteger(parsed.schema_version)) {
    throw new Error("The controls JSON requires format and integer schema_version fields.");
  }
  if (!isRecord(parsed.company_catalog) || !Array.isArray(parsed.role_controls)) {
    throw new Error("The controls JSON requires company_catalog and role_controls fields.");
  }
  if (Number(parsed.schema_version) >= 2 && !isRecord(parsed.purchase_controls)) {
    throw new Error("Schema version 2 controls JSON requires purchase_controls.");
  }

  const sourceCompanyId = Number.isInteger(parsed.company_id) ? Number(parsed.company_id) : null;
  const bundle: CompanyControlsBundle = {
    format: parsed.format,
    schema_version: Number(parsed.schema_version),
    company_id: companyId,
    company_catalog: parsed.company_catalog as CompanyControlsBundle["company_catalog"],
    role_controls: parsed.role_controls as CompanyControlsBundle["role_controls"],
    ...(isRecord(parsed.purchase_controls)
      ? { purchase_controls: parsed.purchase_controls as CompanyControlsBundle["purchase_controls"] }
      : {}),
  };

  return { bundle, sourceCompanyId };
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

export async function companyUsersCsvImportAction(
  _previousState: CompanyUserImportState,
  formData: FormData,
): Promise<CompanyUserImportState> {
  let sourceCsv = String(formData.get("sourceCsv") ?? "");

  try {
    const companyId = requiredCompanyId(formData);
    const intent = String(formData.get("intent") ?? "preview");
    if (intent === "preview") sourceCsv = await uploadedText(formData, "file", "CSV");
    if (!sourceCsv.trim()) throw new Error("CSV source is required.");
    validateSourceSize(sourceCsv, "CSV");

    const rows = intent === "apply"
      ? await applyCompanyUserImport(companyId, sourceCsv)
      : await previewCompanyUserImport(companyId, sourceCsv);

    if (intent === "apply") {
      revalidatePath(`/companies/${companyId}/management`);
      revalidatePath(`/companies/${companyId}/import-export`);
    }

    return {
      phase: intent === "apply" ? "applied" : "preview",
      sourceCsv,
      rows,
      error: null,
    };
  } catch (error) {
    return { phase: "error", sourceCsv, rows: [], error: graphQLErrorMessage(error) };
  }
}

export async function companyControlsImportAction(
  _previousState: CompanyControlsImportState,
  formData: FormData,
): Promise<CompanyControlsImportState> {
  let sourceJson = String(formData.get("sourceJson") ?? "");
  const options = controlsOptions(formData);

  try {
    const companyId = requiredCompanyId(formData);
    const intent = String(formData.get("intent") ?? "preview");
    if (intent === "preview") sourceJson = await uploadedText(formData, "file", "JSON");
    if (!sourceJson.trim()) throw new Error("Controls JSON source is required.");
    validateSourceSize(sourceJson, "JSON");

    const { bundle, sourceCompanyId } = parseControlsBundle(sourceJson, companyId);
    const normalizedSource = `${JSON.stringify(bundle, null, 2)}\n`;
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
      sourceJson: normalizedSource,
      sourceCompanyId,
      options,
      result,
      error: null,
    };
  } catch (error) {
    return {
      phase: "error",
      sourceJson,
      sourceCompanyId: null,
      options,
      result: null,
      error: graphQLErrorMessage(error),
    };
  }
}

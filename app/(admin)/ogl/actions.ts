"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteOglRepMapping,
  fetchOglCompanies,
  importOglCompanies,
  saveOglRepMapping,
  setOglCompanyRepOverride,
  setOglCompanySync,
} from "@/lib/graphql/ogl";
import { graphQLErrorMessage } from "@/lib/graphql/client";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function requiredPositiveInt(formData: FormData, key: string) {
  const raw = requiredString(formData, key);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function oglPath(cref?: string) {
  if (!cref) return "/ogl";
  const params = new URLSearchParams({ cref });
  return `/ogl?${params.toString()}`;
}

function oglMappingsPath() {
  return "/ogl?view=mappings";
}

async function runMutation(target: string, work: () => Promise<string>) {
  let destination = target;
  try {
    const notice = await work();
    revalidatePath("/ogl");
    const separator = target.includes("?") ? "&" : "?";
    destination = `${target}${separator}notice=${encodeURIComponent(notice)}`;
  } catch (error) {
    const separator = target.includes("?") ? "&" : "?";
    destination = `${target}${separator}error=${encodeURIComponent(graphQLErrorMessage(error))}`;
  }
  redirect(destination);
}

export async function fetchOglCompaniesAction() {
  return runMutation("/ogl", async () => {
    const result = await fetchOglCompanies();
    return `Fetched ${result.fetched_count} OGL references: ${result.created_count} new, ${result.existing_count} already registered.`;
  });
}

export async function setOglCompanySyncAction(formData: FormData) {
  const cref = requiredString(formData, "cref");
  const enabled = requiredString(formData, "enabled") === "1";

  return runMutation(oglPath(cref), async () => {
    const result = await setOglCompanySync(cref, enabled);
    return enabled
      ? `OGL sync enabled for ${cref}; ${result.queued_count} import queued.`
      : `OGL sync disabled for ${cref}.`;
  });
}

export async function importSelectedOglCompaniesAction(formData: FormData) {
  const crefs = Array.from(new Set(
    formData.getAll("crefs").map(String).map((value) => value.trim()).filter(Boolean),
  ));

  return runMutation("/ogl", async () => {
    if (!crefs.length) throw new Error("Select at least one sync-enabled OGL company.");
    const result = await importOglCompanies(crefs);
    const skipped = result.skipped_crefs.length
      ? ` Skipped: ${result.skipped_crefs.join(", ")}.`
      : "";
    return `Queued ${result.queued_count} of ${result.requested_count} requested OGL companies.${skipped}`;
  });
}

export async function importAllEnabledOglCompaniesAction() {
  return runMutation("/ogl", async () => {
    const result = await importOglCompanies();
    return `Queued ${result.queued_count} enabled OGL companies.`;
  });
}

export async function saveOglRepMappingAction(formData: FormData) {
  const repCode = requiredString(formData, "repCode");
  const adminUserId = requiredPositiveInt(formData, "adminUserId");

  return runMutation(oglMappingsPath(), async () => {
    const result = await saveOglRepMapping(repCode, adminUserId);
    return `Saved rep mapping ${result.rep_code} → admin #${result.admin_user_id}; ${result.affected_company_count} imported companies updated.`;
  });
}

export async function deleteOglRepMappingAction(formData: FormData) {
  const repCode = requiredString(formData, "repCode");
  const confirmRepCode = requiredString(formData, "confirmRepCode");

  return runMutation(oglMappingsPath(), async () => {
    const result = await deleteOglRepMapping(repCode, confirmRepCode);
    return `Deleted rep mapping ${result.rep_code}; ${result.affected_company_count} company assignments cleared.`;
  });
}

export async function setOglCompanyRepOverrideAction(formData: FormData) {
  const cref = requiredString(formData, "cref");
  const enabled = requiredString(formData, "enabled") === "1";
  const adminUserId = enabled ? requiredPositiveInt(formData, "adminUserId") : null;

  return runMutation(oglPath(cref), async () => {
    const result = await setOglCompanyRepOverride(cref, enabled, adminUserId);
    return enabled
      ? `Rep override enabled for ${cref}; effective admin #${result.effective_sales_representative_id}.`
      : `Rep override removed for ${cref}; assignment returned to ${result.sales_representative_source}.`;
  });
}

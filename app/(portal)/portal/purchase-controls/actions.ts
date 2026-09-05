"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  applyCompanyPortalPurchaseControlTemplate,
  assignCompanyPortalPurchaseControlTemplate,
  deleteCompanyPortalPurchaseControlTemplate,
  resetCompanyPortalPurchaseControlCounters,
  saveCompanyPortalPurchaseControlTemplate,
} from "@/lib/graphql/company-portal-purchase-controls";
import type { SavePurchaseControlRuleInput } from "@/lib/graphql/purchase-controls";

const PURCHASE_CONTROLS_PATH = "/portal/purchase-controls";

function requiredInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function optionalInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function parseRules(raw: string): SavePurchaseControlRuleInput[] {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [sku, quantityRaw, durationRaw, startDate, ...extra] = line.split("|").map((value) => value.trim());
    if (extra.length || !sku || !quantityRaw || !durationRaw || !startDate) {
      throw new Error(`Rule ${index + 1} must use: SKU | quantity limit | duration days | YYYY-MM-DD.`);
    }
    const quantityLimit = Number(quantityRaw);
    const durationDays = Number(durationRaw);
    if (!Number.isInteger(quantityLimit) || quantityLimit < 1) {
      throw new Error(`Rule ${index + 1} quantity limit must be greater than 0.`);
    }
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      throw new Error(`Rule ${index + 1} duration days must be greater than 0.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new Error(`Rule ${index + 1} start date must use YYYY-MM-DD.`);
    }
    return { sku, quantity_limit: quantityLimit, duration_days: durationDays, start_date: startDate };
  });
}

async function runMutation(notice: string, work: () => Promise<unknown>) {
  let errorMessage: string | null = null;
  try {
    await work();
    revalidatePath(PURCHASE_CONTROLS_PATH);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }
  const params = new URLSearchParams();
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  redirect(`${PURCHASE_CONTROLS_PATH}?${params.toString()}`);
}

export async function savePortalPurchaseControlTemplateAction(formData: FormData) {
  const templateId = optionalInt(formData, "templateId");
  const name = String(formData.get("name") ?? "").trim();
  const rules = parseRules(String(formData.get("rules") ?? ""));
  return runMutation(
    templateId ? "Purchase-control template updated." : "Purchase-control template created.",
    () => saveCompanyPortalPurchaseControlTemplate({
      ...(templateId ? { template_id: templateId } : {}),
      name,
      rules,
    }),
  );
}

export async function assignPortalPurchaseControlTemplateAction(formData: FormData) {
  const roleId = requiredInt(formData, "roleId");
  const templateId = optionalInt(formData, "templateId");
  const applyToUsers = formData.get("applyToUsers") !== null;
  return runMutation(
    templateId ? "Purchase-control template assigned to role." : "Purchase-control template unassigned from role.",
    () => assignCompanyPortalPurchaseControlTemplate(roleId, templateId, applyToUsers),
  );
}

export async function applyPortalPurchaseControlTemplateAction(formData: FormData) {
  const templateId = requiredInt(formData, "templateId");
  return runMutation(
    "Purchase-control template applied to eligible users.",
    () => applyCompanyPortalPurchaseControlTemplate(templateId),
  );
}

export async function resetPortalPurchaseControlCountersAction(formData: FormData) {
  const templateId = requiredInt(formData, "templateId");
  return runMutation(
    "Purchase-control counters reset.",
    () => resetCompanyPortalPurchaseControlCounters(templateId),
  );
}

export async function deletePortalPurchaseControlTemplateAction(formData: FormData) {
  const templateId = requiredInt(formData, "templateId");
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  return runMutation(
    "Purchase-control template deleted.",
    () => deleteCompanyPortalPurchaseControlTemplate(templateId, confirmName),
  );
}

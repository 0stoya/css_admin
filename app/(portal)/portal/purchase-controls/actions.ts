"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  applyCompanyPortalPurchaseControlTemplate,
  assignCompanyPortalPurchaseControlTemplate,
  deleteCompanyPortalPurchaseControlTemplate,
  resetCompanyPortalPurchaseControlCounters,
  saveCompanyPortalPurchaseControlTemplate,
} from "@/lib/graphql/company-portal-purchase-controls";
import {
  affectedUsersNotice, assignmentNotice, checkboxChecked, requiredId,
  optionalId, requireAcknowledgement, templateInput,
} from "@/lib/purchase-control-forms";

const PURCHASE_CONTROLS_PATH = "/portal/purchase-controls";

async function runMutation(section: "templates" | "assignments", work: () => Promise<string>) {
  let errorMessage: string | null = null;
  let notice = "";
  try {
    notice = await work();
    revalidatePath(PURCHASE_CONTROLS_PATH);
  } catch (error) {
    unstable_rethrow(error);
    errorMessage = graphQLErrorMessage(error);
  }
  const params = new URLSearchParams({ section });
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  redirect(`${PURCHASE_CONTROLS_PATH}?${params.toString()}`);
}

export async function savePortalPurchaseControlTemplateAction(formData: FormData) {
  return runMutation("templates", async () => {
    await saveCompanyPortalPurchaseControlTemplate(templateInput(formData));
    return "Template saved. New products are added automatically to Employees inheriting this template through Purchase Role. Existing SKU limits and counters are unchanged; use Apply when you want existing limits refreshed.";
  });
}

export async function assignPortalPurchaseControlTemplateAction(formData: FormData) {
  return runMutation("assignments", async () => {
    const roleId = requiredId(formData, "roleId");
    const templateId = optionalId(formData, "templateId");
    const applyToUsers = checkboxChecked(formData, "applyToUsers");
    if (applyToUsers && templateId === null) throw new Error("Select a template before choosing to apply it to users.");
    const result = await assignCompanyPortalPurchaseControlTemplate(roleId, templateId, applyToUsers);
    return assignmentNotice(
      templateId,
      applyToUsers,
      result.cssAssignCompanyPurchaseControlTemplate.applied_users,
      result.cssAssignCompanyPurchaseControlTemplate.applied_employees,
    );
  });
}

export async function applyPortalPurchaseControlTemplateAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    requireAcknowledgement(formData, "confirmApply");
    const result = await applyCompanyPortalPurchaseControlTemplate(templateId);
    return affectedUsersNotice(
      "applied",
      result.cssApplyCompanyPurchaseControlTemplate.affected_users,
      result.cssApplyCompanyPurchaseControlTemplate.affected_employees,
    );
  });
}

export async function resetPortalPurchaseControlCountersAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    requireAcknowledgement(formData, "confirmReset");
    const result = await resetCompanyPortalPurchaseControlCounters(templateId);
    return affectedUsersNotice(
      "reset",
      result.cssResetCompanyPurchaseControlCounters.affected_users,
      result.cssResetCompanyPurchaseControlCounters.affected_employees,
    );
  });
}

export async function deletePortalPurchaseControlTemplateAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    const confirmName = String(formData.get("confirmName") ?? "").trim();
    const result = await deleteCompanyPortalPurchaseControlTemplate(templateId, confirmName);
    if (!result.cssDeleteCompanyPurchaseControlTemplate) throw new Error("Magento did not confirm template deletion.");
    return "Purchase-control template deleted.";
  });
}

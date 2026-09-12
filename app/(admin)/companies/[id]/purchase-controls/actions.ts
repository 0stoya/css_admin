"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  applyPurchaseControlTemplate,
  assignPurchaseControlTemplate,
  deletePurchaseControlTemplate,
  resetPurchaseControlCounters,
  savePurchaseControlTemplate,
} from "@/lib/graphql/purchase-controls";
import {
  affectedUsersNotice, assignmentNotice, checkboxChecked, optionalId,
  requiredId, requireAcknowledgement, templateInput,
} from "@/lib/purchase-control-forms";

type ReturnState = {
  view: "templates" | "assignments" | "allowances" | "history";
  templateId?: number | null;
  roleId?: number | null;
  createOnError?: boolean;
};

function companyIdFromForm(formData: FormData): number {
  try {
    return requiredId(formData, "companyId");
  } catch {
    redirect("/companies?error=Choose+a+valid+company+before+changing+purchase+controls.");
  }
}

async function runMutation(companyId: number, work: () => Promise<string>, state: ReturnState) {
  const path = `/companies/${companyId}/purchase-controls`;
  let errorMessage: string | null = null;
  let notice = "";
  try {
    notice = await work();
    revalidatePath(path);
  } catch (error) {
    unstable_rethrow(error);
    errorMessage = graphQLErrorMessage(error);
  }
  const params = new URLSearchParams({ view: state.view });
  if (state.templateId) params.set("templateId", String(state.templateId));
  if (state.roleId) params.set("roleId", String(state.roleId));
  if (errorMessage && state.createOnError) params.set("create", "1");
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  redirect(`${path}?${params.toString()}`);
}

export async function savePurchaseControlTemplateAction(formData: FormData) {
  const companyId = companyIdFromForm(formData);
  const state: ReturnState = { view: "templates" };
  return runMutation(companyId, async () => {
    state.templateId = optionalId(formData, "templateId");
    state.createOnError = state.templateId === null;
    await savePurchaseControlTemplate(companyId, templateInput(formData));
    return "Template saved. Existing applied allowances and counters were not changed; assign and apply separately when ready.";
  }, state);
}

export async function assignPurchaseControlTemplateAction(formData: FormData) {
  const companyId = companyIdFromForm(formData);
  const state: ReturnState = { view: "assignments" };
  return runMutation(companyId, async () => {
    const roleId = requiredId(formData, "roleId");
    state.roleId = roleId;
    const templateId = optionalId(formData, "templateId");
    const applyToUsers = checkboxChecked(formData, "applyToUsers");
    if (applyToUsers && templateId === null) throw new Error("Select a template before choosing to apply it to users.");
    const result = await assignPurchaseControlTemplate(companyId, roleId, templateId, applyToUsers);
    return assignmentNotice(templateId, applyToUsers, result.cssAdminAssignPurchaseControlTemplate.applied_users);
  }, state);
}

export async function applyPurchaseControlTemplateAction(formData: FormData) {
  const companyId = companyIdFromForm(formData);
  const state: ReturnState = { view: "templates" };
  return runMutation(companyId, async () => {
    const templateId = requiredId(formData, "templateId");
    state.templateId = templateId;
    requireAcknowledgement(formData, "confirmApply");
    const result = await applyPurchaseControlTemplate(companyId, templateId);
    return affectedUsersNotice("applied", result.cssAdminApplyPurchaseControlTemplate.affected_users);
  }, state);
}

export async function resetPurchaseControlCountersAction(formData: FormData) {
  const companyId = companyIdFromForm(formData);
  const state: ReturnState = { view: "templates" };
  return runMutation(companyId, async () => {
    const templateId = requiredId(formData, "templateId");
    state.templateId = templateId;
    requireAcknowledgement(formData, "confirmReset");
    const result = await resetPurchaseControlCounters(companyId, templateId);
    return affectedUsersNotice("reset", result.cssAdminResetPurchaseControlCounters.affected_users);
  }, state);
}

export async function deletePurchaseControlTemplateAction(formData: FormData) {
  const companyId = companyIdFromForm(formData);
  const state: ReturnState = { view: "templates" };
  return runMutation(companyId, async () => {
    const templateId = requiredId(formData, "templateId");
    state.templateId = templateId;
    const confirmName = String(formData.get("confirmName") ?? "").trim();
    const result = await deletePurchaseControlTemplate(companyId, templateId, confirmName);
    if (!result.cssAdminDeletePurchaseControlTemplate) throw new Error("Magento did not confirm template deletion.");
    state.templateId = null;
    return "Purchase-control template deleted.";
  }, state);
}

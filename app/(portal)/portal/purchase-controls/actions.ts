"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  applyCompanyPortalPurchaseControlTemplate,
  assignCompanyPortalPurchaseControlTemplate,
  deleteCompanyPortalPurchaseControlTemplate,
  getCompanyPortalPurchaseControls,
  resetCompanyPortalPurchaseControlCounters,
  saveCompanyPortalPurchaseControlTemplate,
} from "@/lib/graphql/company-portal-purchase-controls";
import {
  affectedUsersNotice, assignmentNotice, checkboxChecked, requiredId,
  optionalId, parsePurchaseRules, requireAcknowledgement, templateInput,
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

export async function updatePortalPurchaseControlRuleAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    const ruleId = requiredId(formData, "ruleId");
    const controls = await getCompanyPortalPurchaseControls();
    const template = controls.templates.find((item) => item.template_id === templateId);
    if (!template) throw new Error("This purchase-control template is no longer available.");

    const existing = template.rules.find((rule) => rule.rule_id === ruleId);
    if (!existing) throw new Error("This purchase-control rule is no longer available.");

    const rawRule = [
      existing.sku,
      String(formData.get("quantityLimit") ?? "").trim(),
      String(formData.get("durationDays") ?? "").trim(),
      String(formData.get("startDate") ?? "").trim(),
      String(formData.get("shortQuantityLimit") ?? "").trim(),
      String(formData.get("shortDurationDays") ?? "").trim(),
    ].join(" | ");
    const [updatedRule] = parsePurchaseRules(rawRule);

    const rules = template.rules.map((rule) => {
      if (rule.rule_id === ruleId) return updatedRule;
      return {
        sku: rule.sku,
        quantity_limit: rule.quantity_limit,
        duration_days: rule.duration_days,
        start_date: rule.start_date,
        ...(rule.short_term_quantity_limit === null
          ? {}
          : { short_term_quantity_limit: rule.short_term_quantity_limit }),
        ...(rule.short_term_duration_days === null
          ? {}
          : { short_term_duration_days: rule.short_term_duration_days }),
      };
    });

    await saveCompanyPortalPurchaseControlTemplate({
      template_id: template.template_id,
      name: template.name,
      rules,
    });

    return `Rule ${existing.sku} updated. Existing buyer and Employee allowances are unchanged until Apply is used.`;
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

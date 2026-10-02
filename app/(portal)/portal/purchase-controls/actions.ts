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

function templateRuleInput(rule: {
  sku: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
  short_term_quantity_limit: number | null;
  short_term_duration_days: number | null;
}) {
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
}

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

    const rules = template.rules.map((rule) =>
      rule.rule_id === ruleId ? updatedRule : templateRuleInput(rule)
    );

    await saveCompanyPortalPurchaseControlTemplate({
      template_id: template.template_id,
      name: template.name,
      rules,
    });

    return `Rule ${existing.sku} updated. Existing buyer and Employee allowances are unchanged until Apply is used.`;
  });
}

export async function deletePortalPurchaseControlRuleAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    const ruleId = requiredId(formData, "ruleId");
    const controls = await getCompanyPortalPurchaseControls();
    const template = controls.templates.find((item) => item.template_id === templateId);
    if (!template) throw new Error("This purchase-control template is no longer available.");

    const existing = template.rules.find((rule) => rule.rule_id === ruleId);
    if (!existing) throw new Error("This purchase-control rule is no longer available.");

    await saveCompanyPortalPurchaseControlTemplate({
      template_id: template.template_id,
      name: template.name,
      rules: template.rules
        .filter((rule) => rule.rule_id !== ruleId)
        .map(templateRuleInput),
    });

    return `Rule ${existing.sku} deleted from the template. Existing buyer and Employee allowances are unchanged until Apply is used.`;
  });
}

export async function addPortalPurchaseControlRulesAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    const additions = parsePurchaseRules(String(formData.get("rules") ?? ""));
    if (!additions.length) throw new Error("Add at least one product rule.");

    const controls = await getCompanyPortalPurchaseControls();
    const template = controls.templates.find((item) => item.template_id === templateId);
    if (!template) throw new Error("This purchase-control template is no longer available.");

    const existingSkus = new Set(
      template.rules.map((rule) => rule.sku.trim().toLocaleLowerCase("en")),
    );
    const duplicate = additions.find((rule) =>
      existingSkus.has(rule.sku.trim().toLocaleLowerCase("en")),
    );
    if (duplicate) {
      throw new Error(`SKU ${duplicate.sku} is already in this template. Edit its existing line instead.`);
    }

    await saveCompanyPortalPurchaseControlTemplate({
      template_id: template.template_id,
      name: template.name,
      rules: [
        ...template.rules.map(templateRuleInput),
        ...additions,
      ],
    });

    return `${additions.length} product rule${additions.length === 1 ? "" : "s"} added. Existing buyer and Employee allowances are unchanged until Apply is used.`;
  });
}

export async function renamePortalPurchaseControlTemplateAction(formData: FormData) {
  return runMutation("templates", async () => {
    const templateId = requiredId(formData, "templateId");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Enter a template name.");

    const controls = await getCompanyPortalPurchaseControls();
    const template = controls.templates.find((item) => item.template_id === templateId);
    if (!template) throw new Error("This purchase-control template is no longer available.");

    await saveCompanyPortalPurchaseControlTemplate({
      template_id: template.template_id,
      name,
      rules: template.rules.map(templateRuleInput),
    });

    return `Template renamed to ${name}.`;
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

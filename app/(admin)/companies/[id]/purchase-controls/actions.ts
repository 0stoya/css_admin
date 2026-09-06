"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  applyPurchaseControlTemplate,
  assignPurchaseControlTemplate,
  deletePurchaseControlTemplate,
  resetPurchaseControlCounters,
  savePurchaseControlTemplate,
  type SavePurchaseControlRuleInput,
} from "@/lib/graphql/purchase-controls";

type PurchaseControlsView = "templates" | "assignments" | "allowances" | "history";

type ReturnState = {
  view: PurchaseControlsView;
  templateId?: number | null;
  roleId?: number | null;
  createOnError?: boolean;
};

function purchaseControlsPath(companyId: number) {
  return `/companies/${companyId}/purchase-controls`;
}

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
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const [skuRaw, quantityRaw, durationRaw, startDateRaw, ...extra] = line
      .split("|")
      .map((value) => value.trim());

    if (extra.length || !skuRaw || !quantityRaw || !durationRaw || !startDateRaw) {
      throw new Error(
        `Rule ${index + 1} must use: SKU | quantity limit | duration days | YYYY-MM-DD.`,
      );
    }

    const quantityLimit = Number(quantityRaw);
    const durationDays = Number(durationRaw);
    if (!Number.isInteger(quantityLimit) || quantityLimit < 1) {
      throw new Error(`Rule ${index + 1} quantity limit must be greater than 0.`);
    }
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      throw new Error(`Rule ${index + 1} duration days must be greater than 0.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) {
      throw new Error(`Rule ${index + 1} start date must use YYYY-MM-DD.`);
    }

    return {
      sku: skuRaw,
      quantity_limit: quantityLimit,
      duration_days: durationDays,
      start_date: startDateRaw,
    };
  });
}

function buildReturnParams(
  notice: string,
  errorMessage: string | null,
  state: ReturnState,
) {
  const params = new URLSearchParams();
  params.set("view", state.view);
  if (state.templateId) params.set("templateId", String(state.templateId));
  if (state.roleId) params.set("roleId", String(state.roleId));
  if (errorMessage && state.createOnError) params.set("create", "1");
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  return params;
}

async function runMutation(
  companyId: number,
  notice: string,
  work: () => Promise<unknown>,
  returnState: ReturnState,
) {
  let errorMessage: string | null = null;

  try {
    await work();
    revalidatePath(purchaseControlsPath(companyId));
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = buildReturnParams(notice, errorMessage, returnState);
  redirect(`${purchaseControlsPath(companyId)}?${params.toString()}`);
}

export async function savePurchaseControlTemplateAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const templateId = optionalInt(formData, "templateId");
  const name = String(formData.get("name") ?? "").trim();
  const rules = parseRules(String(formData.get("rules") ?? ""));

  return runMutation(
    companyId,
    templateId ? "Purchase-control template updated." : "Purchase-control template created.",
    async () => {
      await savePurchaseControlTemplate(companyId, {
        ...(templateId ? { template_id: templateId } : {}),
        name,
        rules,
      });
    },
    {
      view: "templates",
      templateId,
      createOnError: templateId === null,
    },
  );
}

export async function assignPurchaseControlTemplateAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const roleId = requiredInt(formData, "roleId");
  const templateId = optionalInt(formData, "templateId");
  const applyToUsers = formData.get("applyToUsers") !== null;

  return runMutation(
    companyId,
    templateId
      ? "Purchase-control template assigned to role."
      : "Purchase-control template unassigned from role.",
    async () => {
      await assignPurchaseControlTemplate(companyId, roleId, templateId, applyToUsers);
    },
    { view: "assignments", roleId },
  );
}

export async function applyPurchaseControlTemplateAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const templateId = requiredInt(formData, "templateId");
  const confirmed = formData.get("confirmApply") === "yes";

  return runMutation(
    companyId,
    "Purchase-control template applied to eligible users.",
    async () => {
      if (!confirmed) {
        throw new Error(
          "Confirm that the template should overwrite eligible users before applying it.",
        );
      }
      await applyPurchaseControlTemplate(companyId, templateId);
    },
    { view: "templates", templateId },
  );
}

export async function resetPurchaseControlCountersAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const templateId = requiredInt(formData, "templateId");
  const confirmed = formData.get("confirmReset") === "yes";

  return runMutation(
    companyId,
    "Purchase-control counters reset.",
    async () => {
      if (!confirmed) {
        throw new Error(
          "Confirm that consumed purchase-control counters should be reset before continuing.",
        );
      }
      await resetPurchaseControlCounters(companyId, templateId);
    },
    { view: "templates", templateId },
  );
}

export async function deletePurchaseControlTemplateAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const templateId = requiredInt(formData, "templateId");
  const confirmName = String(formData.get("confirmName") ?? "").trim();

  return runMutation(
    companyId,
    "Purchase-control template deleted.",
    async () => {
      await deletePurchaseControlTemplate(companyId, templateId, confirmName);
    },
    { view: "templates", templateId },
  );
}

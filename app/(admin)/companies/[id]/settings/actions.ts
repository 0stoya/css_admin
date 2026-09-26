"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { saveCompanyFinanceVisibility } from "@/lib/company-finance-local";
import {
  deleteCompany,
  getCompanySettings,
  updateCompanySettings,
} from "@/lib/graphql/company-settings";

function settingsPath(companyId: number) {
  return `/companies/${companyId}/settings`;
}

function requiredPositiveInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function requiredNonNegativeInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be zero or greater.`);
  }
  return value;
}

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function redirectMutationResult(
  companyId: number,
  view: "local" | "danger",
  notice: string,
  work: () => Promise<unknown>,
) {
  let errorMessage: string | null = null;

  try {
    await work();
    revalidatePath(settingsPath(companyId));
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/companies/${companyId}/finance`);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = new URLSearchParams({ view });
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);

  redirect(`${settingsPath(companyId)}?${params.toString()}`);
}

export async function updateCompanySettingsAction(formData: FormData) {
  const companyId = requiredPositiveInt(formData, "companyId");

  return redirectMutationResult(companyId, "local", "Company settings updated.", async () => {
    const current = await getCompanySettings(companyId);

    await updateCompanySettings({
      company_id: companyId,
      customer_group_id: requiredNonNegativeInt(formData, "customerGroupId"),
      vat_tax_id: stringValue(formData, "vatTaxId"),
      parent_company_id: current.parent_company_id,
      comment: stringValue(formData, "comment"),
      description: stringValue(formData, "description"),
      homepage_content: stringValue(formData, "homepageContent"),
      show_company_landing_page: formData.get("showCompanyLandingPage") === "on",
      locker_collection_enabled: formData.get("lockerCollectionEnabled") === "on",
    });
  });
}

export async function updateCompanyFinanceVisibilityAction(formData: FormData) {
  const companyId = requiredPositiveInt(formData, "companyId");

  return redirectMutationResult(companyId, "local", "Finance visibility updated.", async () => {
    await saveCompanyFinanceVisibility({
      company_id: companyId,
      show_year_to_date: formData.get("showYearToDate") === "on",
      show_last_7_days: formData.get("showLast7Days") === "on",
      show_last_30_days: formData.get("showLast30Days") === "on",
      show_last_3_months: formData.get("showLast3Months") === "on",
      show_last_6_months: formData.get("showLast6Months") === "on",
      show_last_365_days: formData.get("showLast365Days") === "on",
    });
  });
}

export async function deleteCompanyAction(formData: FormData) {
  const companyId = requiredPositiveInt(formData, "companyId");
  const expectedReference = stringValue(formData, "expectedReference");
  const confirmReference = stringValue(formData, "confirmReference");

  let errorMessage: string | null = null;

  try {
    if (!expectedReference || confirmReference !== expectedReference) {
      throw new Error("Type the exact company reference to confirm deletion.");
    }
    await deleteCompany(companyId, confirmReference);
    revalidatePath("/companies");
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  if (errorMessage) {
    const params = new URLSearchParams({ view: "danger", error: errorMessage });
    redirect(`${settingsPath(companyId)}?${params.toString()}`);
  }

  redirect("/companies");
}

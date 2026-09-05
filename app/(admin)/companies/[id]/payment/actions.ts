"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { saveCompanyPaymentConfiguration } from "@/lib/graphql/payment-configuration";

function paymentPath(companyId: number) {
  return `/companies/${companyId}/payment`;
}

function requiredPositiveInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

export async function saveCompanyPaymentConfigurationAction(formData: FormData) {
  const companyId = requiredPositiveInt(formData, "companyId");
  let errorMessage: string | null = null;

  try {
    await saveCompanyPaymentConfiguration({
      company_id: companyId,
      is_configured: formData.get("isConfigured") === "on",
      is_specific: formData.get("isSpecific") === "on",
      allowed_methods: formData
        .getAll("allowedMethods")
        .map((value) => String(value).trim())
        .filter(Boolean),
    });
    revalidatePath(paymentPath(companyId));
    revalidatePath(`/companies/${companyId}`);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = new URLSearchParams();
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", "Payment configuration updated.");

  redirect(`${paymentPath(companyId)}?${params.toString()}`);
}

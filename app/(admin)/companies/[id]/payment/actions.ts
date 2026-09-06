"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { saveCompanyPaymentConfiguration } from "@/lib/graphql/payment-configuration";

type PaymentMode = "default" | "all" | "specific";

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

function requiredPaymentMode(formData: FormData): PaymentMode {
  const mode = String(formData.get("mode") ?? "").trim();
  if (mode === "default" || mode === "all" || mode === "specific") {
    return mode;
  }
  throw new Error("Choose a payment policy before saving.");
}

export async function saveCompanyPaymentConfigurationAction(formData: FormData) {
  const companyId = requiredPositiveInt(formData, "companyId");
  let errorMessage: string | null = null;

  try {
    const mode = requiredPaymentMode(formData);
    const allowedMethods = formData
      .getAll("allowedMethods")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (mode === "specific" && allowedMethods.length === 0) {
      throw new Error("Choose at least one payment method for a specific-method policy.");
    }

    await saveCompanyPaymentConfiguration({
      company_id: companyId,
      is_configured: mode !== "default",
      is_specific: mode === "specific",
      allowed_methods: allowedMethods,
    });
    revalidatePath(paymentPath(companyId));
    revalidatePath(`/companies/${companyId}`);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = new URLSearchParams();
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", "Payment policy updated.");

  redirect(`${paymentPath(companyId)}?${params.toString()}`);
}

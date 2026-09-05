"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { selectCompanyPortalCompany } from "@/lib/graphql/company-portal";

export async function selectPortalCompanyAction(formData: FormData) {
  const companyId = Number(String(formData.get("companyId") ?? ""));
  let errorMessage: string | null = null;

  if (!Number.isInteger(companyId) || companyId < 1) {
    errorMessage = "Select a valid company.";
  } else {
    try {
      await selectCompanyPortalCompany(companyId);
      revalidatePath("/portal");
    } catch (error) {
      errorMessage = graphQLErrorMessage(error);
    }
  }

  if (errorMessage) {
    redirect(`/portal?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/portal");
}

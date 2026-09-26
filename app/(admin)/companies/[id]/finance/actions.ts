"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildCompanyStructure,
  findCompanyStructureContext,
  flattenCompanyStructure,
} from "@/lib/company-structure";
import {
  isCompanyFinanceStoreConfigured,
  refreshCompanyFinance,
} from "@/lib/company-finance-local";
import { getAllCompanies } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";

function requiredCompanyId(formData: FormData) {
  const raw = String(formData.get("companyId") ?? "").trim();
  const companyId = Number(raw);
  if (!raw || !Number.isInteger(companyId) || companyId <= 0) {
    throw new Error("companyId must be a positive integer.");
  }
  return companyId;
}

function financePath(companyId: number) {
  return `/companies/${companyId}/finance`;
}

function redirectResult(companyId: number, notice: string | null, error: string | null): never {
  const params = new URLSearchParams();
  if (notice) params.set("notice", notice);
  if (error) params.set("error", error);
  redirect(`${financePath(companyId)}?${params.toString()}`);
}

export async function refreshCompanyFinanceAction(formData: FormData) {
  const companyId = requiredCompanyId(formData);
  let errorMessage: string | null = null;

  try {
    await refreshCompanyFinance(companyId);
    revalidatePath(financePath(companyId));
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  redirectResult(
    companyId,
    errorMessage ? null : "Finance snapshot refreshed.",
    errorMessage,
  );
}

export async function refreshCompanyGroupFinanceAction(formData: FormData) {
  const companyId = requiredCompanyId(formData);
  let notice: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (!isCompanyFinanceStoreConfigured()) {
      throw new Error("Local Postgres finance storage must be configured before refreshing a group.");
    }

    const companies = await getAllCompanies();
    const roots = buildCompanyStructure(companies);
    const context = findCompanyStructureContext(roots, companyId);
    if (!context || context.root.company.company_id !== companyId || context.root.children.length === 0) {
      throw new Error("This company is not a visible group head.");
    }

    const companyIds = flattenCompanyStructure(context.root)
      .map((node) => node.company.company_id);

    let refreshed = 0;
    const failures: string[] = [];
    const batchSize = 5;

    for (let index = 0; index < companyIds.length; index += batchSize) {
      const batch = companyIds.slice(index, index + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) => refreshCompanyFinance(id)),
      );

      results.forEach((result, offset) => {
        if (result.status === "fulfilled") {
          refreshed += 1;
        } else {
          const failedId = batch[offset];
          const message = result.reason instanceof Error
            ? result.reason.message
            : "Unexpected finance refresh error.";
          failures.push(`company #${failedId}: ${message}`);
        }
      });
    }

    revalidatePath(financePath(companyId));

    if (failures.length) {
      errorMessage = `Refreshed ${refreshed} of ${companyIds.length} companies. ${failures.slice(0, 3).join("; ")}`;
    } else {
      notice = `Group finance refreshed for ${refreshed} companies.`;
    }
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  redirectResult(companyId, notice, errorMessage);
}

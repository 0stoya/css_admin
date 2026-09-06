"use server";

import {
  getCompanyCatalogProducts,
  type CompanyCatalogProductSearchResult,
} from "@/lib/graphql/company-catalog-products";
import { graphQLErrorMessage } from "@/lib/graphql/client";

export type PurchaseControlProductSearchActionResult =
  | { ok: true; result: CompanyCatalogProductSearchResult }
  | { ok: false; error: string };

export async function searchPurchaseControlProducts(
  companyId: number,
  search: string,
): Promise<PurchaseControlProductSearchActionResult> {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return { ok: false, error: "Invalid company ID." };
  }

  try {
    return {
      ok: true,
      result: await getCompanyCatalogProducts(companyId, 1, 50, search.trim() || undefined),
    };
  } catch (error) {
    return { ok: false, error: graphQLErrorMessage(error) };
  }
}

"use server";

import {
  getCompanyCatalogProducts,
  type CompanyCatalogProductSearchResult,
} from "@/lib/graphql/company-catalog-products";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { customerGraphqlRequest } from "@/lib/graphql/customer-client";

export type PurchaseControlProductSearchActionResult =
  | { ok: true; result: CompanyCatalogProductSearchResult }
  | { ok: false; error: string };

type PortalProductsData = {
  products: {
    total_count: number;
    items: Array<{ id: number; sku: string; name: string }>;
    page_info: { page_size: number; current_page: number; total_pages: number };
  };
};

const PORTAL_PRODUCTS_QUERY = /* GraphQL */ `
  query CompanyPortalPurchaseControlProducts(
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    products(
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
      filter: { price: { from: "0" } }
    ) {
      total_count
      items { id sku name }
      page_info { page_size current_page total_pages }
    }
  }
`;

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


export async function searchPortalPurchaseControlProducts(
  search: string,
): Promise<PurchaseControlProductSearchActionResult> {
  try {
    const data = await customerGraphqlRequest<
      PortalProductsData,
      { currentPage: number; pageSize: number; search?: string }
    >(PORTAL_PRODUCTS_QUERY, {
      currentPage: 1,
      pageSize: 50,
      ...(search.trim() ? { search: search.trim() } : {}),
    });

    return {
      ok: true,
      result: {
        total_count: data.products.total_count,
        items: data.products.items.map((product) => ({
          product_id: Number(product.id),
          sku: product.sku,
          name: product.name,
        })),
        page_info: data.products.page_info,
      },
    };
  } catch (error) {
    return { ok: false, error: graphQLErrorMessage(error) };
  }
}

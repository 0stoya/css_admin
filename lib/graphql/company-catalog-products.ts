import { getMagentoConfig } from "@/lib/config";
import { getAdminToken } from "@/lib/session";

export type CompanyCatalogProductSearchItem = {
  product_id: number;
  sku: string;
  name: string;
};

export type CompanyCatalogProductSearchResult = {
  total_count: number;
  items: CompanyCatalogProductSearchItem[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

export class CompanyCatalogProductSearchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "CompanyCatalogProductSearchError";
  }
}

export async function getCompanyCatalogProducts(
  companyId: number,
  currentPage = 1,
  pageSize = 50,
  search?: string,
): Promise<CompanyCatalogProductSearchResult> {
  const token = await getAdminToken();
  if (!token) {
    throw new CompanyCatalogProductSearchError("Admin authentication is required.", 401);
  }

  const { baseUrl } = getMagentoConfig();
  const params = new URLSearchParams({
    currentPage: String(currentPage),
    pageSize: String(pageSize),
  });
  if (search?.trim()) params.set("search", search.trim());

  const response = await fetch(
    `${baseUrl}/rest/V1/css/admin/companies/${companyId}/catalog-products?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  const body = (await response.json().catch(() => null)) as
    | CompanyCatalogProductSearchResult
    | { message?: string }
    | null;

  if (!response.ok) {
    const message = body && "message" in body && body.message
      ? body.message
      : `Magento REST returned HTTP ${response.status}.`;
    throw new CompanyCatalogProductSearchError(message, response.status);
  }

  if (!body || !("items" in body) || !("page_info" in body)) {
    throw new CompanyCatalogProductSearchError("Magento REST returned an invalid product-search response.");
  }

  return body;
}

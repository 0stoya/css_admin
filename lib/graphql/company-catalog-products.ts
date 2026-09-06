import { adminGraphqlRequest } from "@/lib/graphql/client";

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

type CompanyCatalogProductsData = {
  css_admin_company_catalog_products: CompanyCatalogProductSearchResult;
};

const COMPANY_CATALOG_PRODUCTS_QUERY = /* GraphQL */ `
  query AdminCompanyCatalogProducts(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_admin_company_catalog_products(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        product_id
        sku
        name
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

export async function getCompanyCatalogProducts(
  companyId: number,
  currentPage = 1,
  pageSize = 50,
  search?: string,
): Promise<CompanyCatalogProductSearchResult> {
  const data = await adminGraphqlRequest<
    CompanyCatalogProductsData,
    { companyId: number; currentPage: number; pageSize: number; search?: string }
  >(COMPANY_CATALOG_PRODUCTS_QUERY, {
    companyId,
    currentPage,
    pageSize,
    ...(search ? { search } : {}),
  });

  return data.css_admin_company_catalog_products;
}

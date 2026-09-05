import { graphqlRequest } from "@/lib/graphql/client";

export type CompanyPricingStatus = {
  company_id: number;
  cref: string | null;
  company_active: boolean;
  sync_enabled: boolean;
  has_custom_prices: boolean;
  custom_price_count: number;
  import_status: string;
  import_percentage: number;
  status_message: string;
  last_imported_at: string | null;
  currency: string;
};

export type CompanyPriceTier = {
  quantity: number;
  price: number;
};

export type CompanyPrice = {
  sku: string;
  product_id: number | null;
  product_name: string | null;
  price: number;
  tier_prices: CompanyPriceTier[];
};

export type CompanyPriceSearchResult = {
  total_count: number;
  items: CompanyPrice[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

type CompanyPricingStatusData = {
  css_admin_company_pricing_status: CompanyPricingStatus;
};

type CompanyPricesData = {
  css_admin_company_prices: CompanyPriceSearchResult;
};

const COMPANY_PRICING_STATUS_QUERY = /* GraphQL */ `
  query AdminCompanyPricingStatus($companyId: Int!) {
    css_admin_company_pricing_status(company_id: $companyId) {
      company_id
      cref
      company_active
      sync_enabled
      has_custom_prices
      custom_price_count
      import_status
      import_percentage
      status_message
      last_imported_at
      currency
    }
  }
`;

const COMPANY_PRICES_QUERY = /* GraphQL */ `
  query AdminCompanyPrices(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_admin_company_prices(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        sku
        product_id
        product_name
        price
        tier_prices {
          quantity
          price
        }
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

export async function getCompanyPricingStatus(companyId: number) {
  const data = await graphqlRequest<CompanyPricingStatusData, { companyId: number }>(
    COMPANY_PRICING_STATUS_QUERY,
    { companyId },
  );

  return data.css_admin_company_pricing_status;
}

export async function getCompanyPrices(
  companyId: number,
  currentPage = 1,
  pageSize = 20,
  search = "",
) {
  const data = await graphqlRequest<
    CompanyPricesData,
    { companyId: number; currentPage: number; pageSize: number; search: string | null }
  >(
    COMPANY_PRICES_QUERY,
    {
      companyId,
      currentPage,
      pageSize,
      search: search.trim() || null,
    },
  );

  return data.css_admin_company_prices;
}

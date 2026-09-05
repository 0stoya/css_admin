import { graphqlPartialRequest, graphqlRequest } from "@/lib/graphql/client";

export type CompanySummary = {
  company_id: number;
  reference: string | null;
  name: string;
  sales_representative_id: number | null;
};

export type CompanyList = {
  total_count: number;
  items: CompanySummary[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

type CompanyListData = { css_admin_companies: CompanyList };
type CompanyDetailData = { css_admin_company: CompanySummary };
type Typename = { __typename: string };
type ManagementProbeData = {
  management: Typename | null;
  catalog: Typename | null;
  purchase_controls: Typename | null;
  commercial: Typename | null;
  credit_orders: Typename | null;
};

const COMPANY_LIST_QUERY = /* GraphQL */ `
  query AdminCompanyList($currentPage: Int!, $pageSize: Int!) {
    css_admin_companies(currentPage: $currentPage, pageSize: $pageSize) {
      total_count
      items {
        company_id
        reference
        name
        sales_representative_id
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

const COMPANY_DETAIL_QUERY = /* GraphQL */ `
  query AdminCompanyDetail($companyId: Int!) {
    css_admin_company(company_id: $companyId) {
      company_id
      reference
      name
      sales_representative_id
    }
  }
`;

const MANAGEMENT_PROBE_QUERY = /* GraphQL */ `
  query AdminCompanyManagementAvailability($companyId: Int!) {
    management: css_admin_company_management(company_id: $companyId) { __typename }
    catalog: css_admin_company_catalog_policy(company_id: $companyId) { __typename }
    purchase_controls: css_admin_purchase_controls(company_id: $companyId) { __typename }
    commercial: css_admin_company_payment_configuration(company_id: $companyId) { __typename }
    credit_orders: css_admin_credit_orders(company_id: $companyId, currentPage: 1, pageSize: 1) { __typename }
  }
`;

export async function getCompanies(currentPage = 1, pageSize = 100) {
  const data = await graphqlRequest<CompanyListData, { currentPage: number; pageSize: number }>(
    COMPANY_LIST_QUERY,
    { currentPage, pageSize },
  );
  return data.css_admin_companies;
}

export async function getCompany(companyId: number) {
  const data = await graphqlRequest<CompanyDetailData, { companyId: number }>(
    COMPANY_DETAIL_QUERY,
    { companyId },
  );
  return data.css_admin_company;
}

export async function getCompanyManagementAvailability(companyId: number) {
  const response = await graphqlPartialRequest<ManagementProbeData, { companyId: number }>(
    MANAGEMENT_PROBE_QUERY,
    { companyId },
  );

  const data = response.data;
  return {
    management: Boolean(data?.management),
    catalog: Boolean(data?.catalog),
    purchase_controls: Boolean(data?.purchase_controls),
    commercial: Boolean(data?.commercial),
    credit_orders: Boolean(data?.credit_orders),
  };
}

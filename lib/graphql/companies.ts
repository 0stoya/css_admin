import { graphqlRequest } from "@/lib/graphql/client";

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

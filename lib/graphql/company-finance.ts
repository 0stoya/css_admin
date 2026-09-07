import { graphqlRequest } from "@/lib/graphql/client";

export type CompanyFinancePeriod = {
  order_count: number;
  value: number;
};

export type CompanyFinanceMonth = CompanyFinancePeriod & {
  month: number;
};

export type CompanyFinancialSummary = {
  company_id: number;
  cref: string | null;
  currency: string;
  year: number;
  year_to_date: CompanyFinancePeriod;
  last_7_days: CompanyFinancePeriod;
  last_30_days: CompanyFinancePeriod;
  last_3_months: CompanyFinancePeriod;
  last_6_months: CompanyFinancePeriod;
  monthly: CompanyFinanceMonth[];
  last_order_date: string | null;
  refreshed_at: string;
};

type CompanyFinancialSummaryData = {
  css_admin_company_financial_summary: CompanyFinancialSummary;
};

const COMPANY_FINANCIAL_SUMMARY_QUERY = /* GraphQL */ `
  query AdminCompanyFinancialSummary($companyId: Int!) {
    css_admin_company_financial_summary(company_id: $companyId) {
      company_id
      cref
      currency
      year
      year_to_date {
        order_count
        value
      }
      last_7_days {
        order_count
        value
      }
      last_30_days {
        order_count
        value
      }
      last_3_months {
        order_count
        value
      }
      last_6_months {
        order_count
        value
      }
      monthly {
        month
        order_count
        value
      }
      last_order_date
      refreshed_at
    }
  }
`;

export async function getCompanyFinancialSummary(companyId: number) {
  const data = await graphqlRequest<CompanyFinancialSummaryData, { companyId: number }>(
    COMPANY_FINANCIAL_SUMMARY_QUERY,
    { companyId },
  );

  return data.css_admin_company_financial_summary;
}

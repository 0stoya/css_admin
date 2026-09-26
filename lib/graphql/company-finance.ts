import {
  GraphQLRequestError,
  graphqlRequest,
} from "@/lib/graphql/client";

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
  last_365_days: CompanyFinancePeriod | null;
  monthly: CompanyFinanceMonth[];
  last_order_date: string | null;
  refreshed_at: string;
};

type CompanyFinancialSummaryRaw = Omit<CompanyFinancialSummary, "last_365_days"> & {
  last_365_days?: CompanyFinancePeriod | null;
};

type CompanyFinancialSummaryData = {
  css_admin_company_financial_summary: CompanyFinancialSummaryRaw;
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
      last_365_days {
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

const LEGACY_COMPANY_FINANCIAL_SUMMARY_QUERY = /* GraphQL */ `
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

let rolling365Supported: boolean | null = null;

function normaliseSummary(summary: CompanyFinancialSummaryRaw): CompanyFinancialSummary {
  return {
    ...summary,
    last_365_days: summary.last_365_days ?? null,
  };
}

function missingRolling365Field(error: unknown) {
  return error instanceof GraphQLRequestError
    && error.errors.some(
      (item) => item.message.includes("Cannot query field")
        && item.message.includes("last_365_days"),
    );
}

async function requestFinancialSummary(query: string, companyId: number) {
  const data = await graphqlRequest<CompanyFinancialSummaryData, { companyId: number }>(
    query,
    { companyId },
  );

  return normaliseSummary(data.css_admin_company_financial_summary);
}

export async function getCompanyFinancialSummary(companyId: number) {
  if (rolling365Supported === false) {
    return requestFinancialSummary(LEGACY_COMPANY_FINANCIAL_SUMMARY_QUERY, companyId);
  }

  try {
    const summary = await requestFinancialSummary(COMPANY_FINANCIAL_SUMMARY_QUERY, companyId);
    rolling365Supported = true;
    return summary;
  } catch (error) {
    if (!missingRolling365Field(error)) throw error;
    rolling365Supported = false;
    return requestFinancialSummary(LEGACY_COMPANY_FINANCIAL_SUMMARY_QUERY, companyId);
  }
}

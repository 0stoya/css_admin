import { graphqlRequest } from "@/lib/graphql/client";

export type CompanyCredit = {
  company_id: number;
  credit_id: number | null;
  has_credit_account: boolean;
  credit_limit: number | null;
  used_amount: number | null;
  remaining_amount: number | null;
  currency: string | null;
  allow_over_limit: boolean;
};

type CompanyCreditData = {
  css_admin_company_credit: CompanyCredit;
};

const COMPANY_CREDIT_QUERY = /* GraphQL */ `
  query AdminCompanyCredit($companyId: Int!) {
    css_admin_company_credit(company_id: $companyId) {
      company_id
      credit_id
      has_credit_account
      credit_limit
      used_amount
      remaining_amount
      currency
      allow_over_limit
    }
  }
`;

export async function getCompanyCredit(companyId: number) {
  const data = await graphqlRequest<CompanyCreditData, { companyId: number }>(
    COMPANY_CREDIT_QUERY,
    { companyId },
  );

  return data.css_admin_company_credit;
}

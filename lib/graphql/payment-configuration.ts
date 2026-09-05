import { graphqlRequest } from "@/lib/graphql/client";

export type PaymentMethodOption = {
  code: string;
  label: string;
};

export type CompanyPaymentConfiguration = {
  company_id: number;
  is_configured: boolean;
  is_specific: boolean;
  allowed_methods: string[];
  available_methods: PaymentMethodOption[];
};

export type SaveCompanyPaymentConfigurationInput = {
  company_id: number;
  is_configured: boolean;
  is_specific: boolean;
  allowed_methods: string[];
};

type CompanyPaymentConfigurationData = {
  css_admin_company_payment_configuration: CompanyPaymentConfiguration;
};

type SaveCompanyPaymentConfigurationData = {
  cssAdminSaveCompanyPaymentConfiguration: CompanyPaymentConfiguration;
};

const COMPANY_PAYMENT_CONFIGURATION_QUERY = /* GraphQL */ `
  query AdminCompanyPaymentConfiguration($companyId: Int!) {
    css_admin_company_payment_configuration(company_id: $companyId) {
      company_id
      is_configured
      is_specific
      allowed_methods
      available_methods {
        code
        label
      }
    }
  }
`;

const SAVE_COMPANY_PAYMENT_CONFIGURATION_MUTATION = /* GraphQL */ `
  mutation AdminSaveCompanyPaymentConfiguration($input: CssAdminSaveCompanyPaymentConfigurationInput!) {
    cssAdminSaveCompanyPaymentConfiguration(input: $input) {
      company_id
      is_configured
      is_specific
      allowed_methods
      available_methods {
        code
        label
      }
    }
  }
`;

export async function getCompanyPaymentConfiguration(companyId: number) {
  const data = await graphqlRequest<CompanyPaymentConfigurationData, { companyId: number }>(
    COMPANY_PAYMENT_CONFIGURATION_QUERY,
    { companyId },
  );

  return data.css_admin_company_payment_configuration;
}

export async function saveCompanyPaymentConfiguration(input: SaveCompanyPaymentConfigurationInput) {
  const data = await graphqlRequest<
    SaveCompanyPaymentConfigurationData,
    { input: SaveCompanyPaymentConfigurationInput }
  >(SAVE_COMPANY_PAYMENT_CONFIGURATION_MUTATION, { input });

  return data.cssAdminSaveCompanyPaymentConfiguration;
}

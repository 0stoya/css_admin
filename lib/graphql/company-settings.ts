import { graphqlRequest } from "@/lib/graphql/client";

export type CompanySettings = {
  company_id: number;
  reference: string | null;
  status: boolean;
  name: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  country_code: string | null;
  region: string | null;
  region_id: number | null;
  postcode: string | null;
  telephone: string | null;
  vat_tax_id: string | null;
  customer_group_id: number | null;
  admin_customer_id: number | null;
  sales_representative_id: number | null;
  parent_company_id: number | null;
  comment: string | null;
  description: string | null;
  homepage_content: string | null;
  show_company_landing_page: boolean;
};

export type CompanyCustomerGroup = {
  customer_group_id: number;
  code: string;
};

export type CompanySettingsOptions = {
  customer_groups: CompanyCustomerGroup[];
};

export type UpdateCompanySettingsInput = {
  company_id: number;
  vat_tax_id: string;
  customer_group_id: number;
  parent_company_id: number | null;
  comment: string;
  description: string;
  homepage_content: string;
  show_company_landing_page: boolean;
};

type CompanySettingsData = {
  css_admin_company: CompanySettings;
};

type CompanySettingsOptionsData = {
  css_admin_company_options: CompanySettingsOptions;
};

type UpdateCompanySettingsData = {
  cssAdminUpdateCompany: CompanySettings;
};

type DeleteCompanyData = {
  cssAdminDeleteCompany: boolean;
};

const COMPANY_SETTINGS_QUERY = /* GraphQL */ `
  query AdminCompanySettings($companyId: Int!) {
    css_admin_company(company_id: $companyId) {
      company_id
      reference
      status
      name
      email
      street
      city
      country_code
      region
      region_id
      postcode
      telephone
      vat_tax_id
      customer_group_id
      admin_customer_id
      sales_representative_id
      parent_company_id
      comment
      description
      homepage_content
      show_company_landing_page
    }
  }
`;

const COMPANY_SETTINGS_OPTIONS_QUERY = /* GraphQL */ `
  query AdminCompanySettingsOptions {
    css_admin_company_options {
      customer_groups {
        customer_group_id
        code
      }
    }
  }
`;

const UPDATE_COMPANY_SETTINGS_MUTATION = /* GraphQL */ `
  mutation AdminUpdateCompanySettings($input: CssAdminUpdateCompanyInput!) {
    cssAdminUpdateCompany(input: $input) {
      company_id
      reference
      status
      name
      email
      street
      city
      country_code
      region
      region_id
      postcode
      telephone
      vat_tax_id
      customer_group_id
      admin_customer_id
      sales_representative_id
      parent_company_id
      comment
      description
      homepage_content
      show_company_landing_page
    }
  }
`;

const DELETE_COMPANY_MUTATION = /* GraphQL */ `
  mutation AdminDeleteCompany($companyId: Int!, $confirmReference: String!) {
    cssAdminDeleteCompany(company_id: $companyId, confirm_reference: $confirmReference)
  }
`;

export async function getCompanySettings(companyId: number) {
  const data = await graphqlRequest<CompanySettingsData, { companyId: number }>(
    COMPANY_SETTINGS_QUERY,
    { companyId },
  );

  return data.css_admin_company;
}

export async function getCompanySettingsOptions() {
  const data = await graphqlRequest<CompanySettingsOptionsData, Record<string, never>>(
    COMPANY_SETTINGS_OPTIONS_QUERY,
    {},
  );

  return data.css_admin_company_options;
}

export async function updateCompanySettings(input: UpdateCompanySettingsInput) {
  const data = await graphqlRequest<UpdateCompanySettingsData, { input: UpdateCompanySettingsInput }>(
    UPDATE_COMPANY_SETTINGS_MUTATION,
    { input },
  );

  return data.cssAdminUpdateCompany;
}

export async function deleteCompany(companyId: number, confirmReference: string) {
  const data = await graphqlRequest<
    DeleteCompanyData,
    { companyId: number; confirmReference: string }
  >(
    DELETE_COMPANY_MUTATION,
    { companyId, confirmReference },
  );

  return data.cssAdminDeleteCompany;
}

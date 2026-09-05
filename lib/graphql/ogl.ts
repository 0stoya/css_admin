import { graphqlRequest } from "@/lib/graphql/client";

export type OglCompany = {
  cref: string;
  sync_enabled: boolean;
  company_id: number | null;
  imported: boolean;
  updated_at: string | null;
  ogl_rep_code: string | null;
  rep_override_enabled: boolean;
  rep_override_user_id: number | null;
  mapped_sales_representative_id: number | null;
  effective_sales_representative_id: number | null;
  sales_representative_source: string;
};

export type OglCompanySearchResult = {
  ogl_enabled: boolean;
  company_import_enabled: boolean;
  total_count: number;
  items: OglCompany[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

export type OglCompanyPreview = {
  cref: string;
  importable: boolean;
  reason: string | null;
  sync_enabled: boolean;
  existing_company_id: number | null;
  company_name: string | null;
  company_status: boolean | null;
  admin_email: string | null;
  admin_firstname: string | null;
  admin_lastname: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country_code: string | null;
  telephone: string | null;
  website_id: number | null;
  credit_limit: number | null;
  balance: number | null;
  cash_sale: boolean | null;
  delivery_code: string | null;
  ogl_rep_code: string | null;
  rep_override_enabled: boolean;
  rep_override_user_id: number | null;
  mapped_sales_representative_id: number | null;
  effective_sales_representative_id: number | null;
  sales_representative_source: string;
};

export type OglRepMapping = {
  rep_code: string;
  admin_user_id: number;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  active: boolean;
  affected_company_count: number;
};

export type OglSyncResult = {
  company: OglCompany;
  queued_count: number;
};

export type OglImportResult = {
  requested_count: number;
  eligible_count: number;
  queued_count: number;
  skipped_crefs: string[];
};

export type OglRepMappingActionResult = {
  rep_code: string;
  admin_user_id: number | null;
  affected_company_count: number;
  deleted: boolean;
};

export type OglRepAssignment = {
  cref: string;
  company_id: number | null;
  ogl_rep_code: string | null;
  rep_override_enabled: boolean;
  rep_override_user_id: number | null;
  mapped_sales_representative_id: number | null;
  effective_sales_representative_id: number | null;
  sales_representative_source: string;
};

type OglCompaniesData = { css_admin_ogl_companies: OglCompanySearchResult };
type OglPreviewData = { css_admin_ogl_company_preview: OglCompanyPreview };
type OglMappingsData = { css_admin_ogl_rep_mappings: OglRepMapping[] };
type FetchOglData = {
  cssAdminFetchOglCompanies: {
    fetched_count: number;
    created_count: number;
    existing_count: number;
  };
};
type SetOglSyncData = { cssAdminSetOglCompanySync: OglSyncResult };
type ImportOglData = { cssAdminImportOglCompanies: OglImportResult };
type SaveMappingData = { cssAdminSaveOglRepMapping: OglRepMappingActionResult };
type DeleteMappingData = { cssAdminDeleteOglRepMapping: OglRepMappingActionResult };
type SetOverrideData = { cssAdminSetOglCompanyRepOverride: OglRepAssignment };

const OGL_COMPANY_FIELDS = /* GraphQL */ `
  cref
  sync_enabled
  company_id
  imported
  updated_at
  ogl_rep_code
  rep_override_enabled
  rep_override_user_id
  mapped_sales_representative_id
  effective_sales_representative_id
  sales_representative_source
`;

const OGL_COMPANIES_QUERY = /* GraphQL */ `
  query AdminOglCompanies(
    $currentPage: Int!
    $pageSize: Int!
    $search: String
    $syncEnabled: Boolean
    $imported: Boolean
  ) {
    css_admin_ogl_companies(
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
      sync_enabled: $syncEnabled
      imported: $imported
    ) {
      ogl_enabled
      company_import_enabled
      total_count
      items {
        ${OGL_COMPANY_FIELDS}
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

const OGL_PREVIEW_QUERY = /* GraphQL */ `
  query AdminOglCompanyPreview($cref: String!) {
    css_admin_ogl_company_preview(cref: $cref) {
      cref
      importable
      reason
      sync_enabled
      existing_company_id
      company_name
      company_status
      admin_email
      admin_firstname
      admin_lastname
      address_line_1
      address_line_2
      city
      region
      postcode
      country_code
      telephone
      website_id
      credit_limit
      balance
      cash_sale
      delivery_code
      ogl_rep_code
      rep_override_enabled
      rep_override_user_id
      mapped_sales_representative_id
      effective_sales_representative_id
      sales_representative_source
    }
  }
`;

const OGL_MAPPINGS_QUERY = /* GraphQL */ `
  query AdminOglRepMappings {
    css_admin_ogl_rep_mappings {
      rep_code
      admin_user_id
      username
      firstname
      lastname
      email
      active
      affected_company_count
    }
  }
`;

const FETCH_OGL_COMPANIES_MUTATION = /* GraphQL */ `
  mutation AdminFetchOglCompanies {
    cssAdminFetchOglCompanies {
      fetched_count
      created_count
      existing_count
    }
  }
`;

const SET_OGL_SYNC_MUTATION = /* GraphQL */ `
  mutation AdminSetOglCompanySync($cref: String!, $enabled: Boolean!) {
    cssAdminSetOglCompanySync(cref: $cref, enabled: $enabled) {
      queued_count
      company {
        ${OGL_COMPANY_FIELDS}
      }
    }
  }
`;

const IMPORT_OGL_COMPANIES_MUTATION = /* GraphQL */ `
  mutation AdminImportOglCompanies($crefs: [String!]) {
    cssAdminImportOglCompanies(crefs: $crefs) {
      requested_count
      eligible_count
      queued_count
      skipped_crefs
    }
  }
`;

const SAVE_OGL_REP_MAPPING_MUTATION = /* GraphQL */ `
  mutation AdminSaveOglRepMapping($repCode: String!, $adminUserId: Int!) {
    cssAdminSaveOglRepMapping(rep_code: $repCode, admin_user_id: $adminUserId) {
      rep_code
      admin_user_id
      affected_company_count
      deleted
    }
  }
`;

const DELETE_OGL_REP_MAPPING_MUTATION = /* GraphQL */ `
  mutation AdminDeleteOglRepMapping($repCode: String!, $confirmRepCode: String!) {
    cssAdminDeleteOglRepMapping(rep_code: $repCode, confirm_rep_code: $confirmRepCode) {
      rep_code
      admin_user_id
      affected_company_count
      deleted
    }
  }
`;

const SET_OGL_REP_OVERRIDE_MUTATION = /* GraphQL */ `
  mutation AdminSetOglCompanyRepOverride(
    $cref: String!
    $enabled: Boolean!
    $adminUserId: Int
  ) {
    cssAdminSetOglCompanyRepOverride(
      cref: $cref
      enabled: $enabled
      admin_user_id: $adminUserId
    ) {
      cref
      company_id
      ogl_rep_code
      rep_override_enabled
      rep_override_user_id
      mapped_sales_representative_id
      effective_sales_representative_id
      sales_representative_source
    }
  }
`;

export async function getOglCompanies(
  currentPage = 1,
  pageSize = 100,
  search?: string,
  syncEnabled?: boolean,
  imported?: boolean,
) {
  const data = await graphqlRequest<
    OglCompaniesData,
    {
      currentPage: number;
      pageSize: number;
      search: string | null;
      syncEnabled: boolean | null;
      imported: boolean | null;
    }
  >(
    OGL_COMPANIES_QUERY,
    {
      currentPage,
      pageSize,
      search: search?.trim() || null,
      syncEnabled: syncEnabled ?? null,
      imported: imported ?? null,
    },
  );
  return data.css_admin_ogl_companies;
}

export async function getOglCompanyPreview(cref: string) {
  const data = await graphqlRequest<OglPreviewData, { cref: string }>(
    OGL_PREVIEW_QUERY,
    { cref: cref.trim() },
  );
  return data.css_admin_ogl_company_preview;
}

export async function getOglRepMappings() {
  const data = await graphqlRequest<OglMappingsData, Record<string, never>>(
    OGL_MAPPINGS_QUERY,
    {},
  );
  return data.css_admin_ogl_rep_mappings;
}

export async function fetchOglCompanies() {
  const data = await graphqlRequest<FetchOglData, Record<string, never>>(
    FETCH_OGL_COMPANIES_MUTATION,
    {},
  );
  return data.cssAdminFetchOglCompanies;
}

export async function setOglCompanySync(cref: string, enabled: boolean) {
  const data = await graphqlRequest<SetOglSyncData, { cref: string; enabled: boolean }>(
    SET_OGL_SYNC_MUTATION,
    { cref, enabled },
  );
  return data.cssAdminSetOglCompanySync;
}

export async function importOglCompanies(crefs?: string[]) {
  const data = await graphqlRequest<ImportOglData, { crefs: string[] | null }>(
    IMPORT_OGL_COMPANIES_MUTATION,
    { crefs: crefs ?? null },
  );
  return data.cssAdminImportOglCompanies;
}

export async function saveOglRepMapping(repCode: string, adminUserId: number) {
  const data = await graphqlRequest<SaveMappingData, { repCode: string; adminUserId: number }>(
    SAVE_OGL_REP_MAPPING_MUTATION,
    { repCode, adminUserId },
  );
  return data.cssAdminSaveOglRepMapping;
}

export async function deleteOglRepMapping(repCode: string, confirmRepCode: string) {
  const data = await graphqlRequest<
    DeleteMappingData,
    { repCode: string; confirmRepCode: string }
  >(
    DELETE_OGL_REP_MAPPING_MUTATION,
    { repCode, confirmRepCode },
  );
  return data.cssAdminDeleteOglRepMapping;
}

export async function setOglCompanyRepOverride(
  cref: string,
  enabled: boolean,
  adminUserId: number | null,
) {
  const data = await graphqlRequest<
    SetOverrideData,
    { cref: string; enabled: boolean; adminUserId: number | null }
  >(
    SET_OGL_REP_OVERRIDE_MUTATION,
    { cref, enabled, adminUserId },
  );
  return data.cssAdminSetOglCompanyRepOverride;
}

import { graphqlRequest } from "@/lib/graphql/client";
import { customerGraphqlRequest } from "@/lib/graphql/customer-client";

export type CompanyRepContact = {
  rep_code: string | null;
  source: string;
  admin_user_id: number;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  image_url: string | null;
  profile_message: string | null;
};

export type CompanyPresentation = {
  company_id: number;
  company_name: string | null;
  company_reference: string | null;
  company_email: string | null;
  company_phone: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country_code: string | null;
  enabled: boolean;
  portal_title: string | null;
  welcome_heading: string | null;
  welcome_text: string | null;
  company_description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  procurement_email: string | null;
  logo_url: string | null;
  banner_url: string | null;
  updated_at: string | null;
  can_view_rep_contacts: boolean;
  rep_contacts: CompanyRepContact[];
};

export type CompanyPresentationInput = {
  enabled?: boolean;
  portal_title?: string | null;
  welcome_heading?: string | null;
  welcome_text?: string | null;
  company_description?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  procurement_email?: string | null;
};

export type AdminOglRepProfile = {
  rep_code: string;
  admin_user_id: number;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  mapped_email: string | null;
  admin_active: boolean;
  affected_company_count: number;
  profile_active: boolean;
  job_title: string | null;
  phone: string | null;
  mobile: string | null;
  display_email: string | null;
  photo_url: string | null;
  profile_message: string | null;
  updated_at: string | null;
};

export type OglRepProfileInput = {
  profile_active?: boolean;
  job_title?: string | null;
  phone?: string | null;
  mobile?: string | null;
  display_email?: string | null;
  profile_message?: string | null;
};

const PRESENTATION_FIELDS = /* GraphQL */ `
  company_id
  company_name
  company_reference
  company_email
  company_phone
  street
  city
  region
  postcode
  country_code
  enabled
  portal_title
  welcome_heading
  welcome_text
  company_description
  contact_phone
  contact_email
  procurement_email
  logo_url
  banner_url
  updated_at
  can_view_rep_contacts
  rep_contacts {
    rep_code
    source
    admin_user_id
    name
    job_title
    email
    phone
    mobile
    image_url
    profile_message
  }
`;

const REP_PROFILE_FIELDS = /* GraphQL */ `
  rep_code
  admin_user_id
  username
  firstname
  lastname
  mapped_email
  admin_active
  affected_company_count
  profile_active
  job_title
  phone
  mobile
  display_email
  photo_url
  profile_message
  updated_at
`;

const ADMIN_PRESENTATION_QUERY = /* GraphQL */ `
  query AdminCompanyPresentation($companyId: Int!) {
    css_admin_company_presentation(company_id: $companyId) { ${PRESENTATION_FIELDS} }
  }
`;

const PORTAL_PRESENTATION_QUERY = /* GraphQL */ `
  query CompanyPresentation {
    css_company_presentation { ${PRESENTATION_FIELDS} }
  }
`;

const REP_PROFILES_QUERY = /* GraphQL */ `
  query AdminOglRepProfiles {
    css_admin_ogl_rep_profiles { ${REP_PROFILE_FIELDS} }
  }
`;

const SAVE_PRESENTATION_MUTATION = /* GraphQL */ `
  mutation AdminSaveCompanyPresentation($companyId: Int!, $input: CssCompanyPresentationInput!) {
    cssAdminSaveCompanyPresentation(company_id: $companyId, input: $input) { ${PRESENTATION_FIELDS} }
  }
`;

const UPLOAD_PRESENTATION_MEDIA_MUTATION = /* GraphQL */ `
  mutation AdminUploadCompanyPresentationMedia(
    $companyId: Int!
    $kind: CssCompanyPresentationMediaKind!
    $input: CssPresentationMediaUploadInput!
  ) {
    cssAdminUploadCompanyPresentationMedia(company_id: $companyId, kind: $kind, input: $input) {
      ${PRESENTATION_FIELDS}
    }
  }
`;

const CLEAR_PRESENTATION_MEDIA_MUTATION = /* GraphQL */ `
  mutation AdminClearCompanyPresentationMedia($companyId: Int!, $kind: CssCompanyPresentationMediaKind!) {
    cssAdminClearCompanyPresentationMedia(company_id: $companyId, kind: $kind) { ${PRESENTATION_FIELDS} }
  }
`;

const SAVE_REP_PROFILE_MUTATION = /* GraphQL */ `
  mutation AdminSaveOglRepProfile($repCode: String!, $input: CssOglRepProfileInput!) {
    cssAdminSaveOglRepProfile(rep_code: $repCode, input: $input) { ${REP_PROFILE_FIELDS} }
  }
`;

const UPLOAD_REP_PHOTO_MUTATION = /* GraphQL */ `
  mutation AdminUploadOglRepPhoto($repCode: String!, $input: CssPresentationMediaUploadInput!) {
    cssAdminUploadOglRepPhoto(rep_code: $repCode, input: $input) { ${REP_PROFILE_FIELDS} }
  }
`;

const CLEAR_REP_PHOTO_MUTATION = /* GraphQL */ `
  mutation AdminClearOglRepPhoto($repCode: String!) {
    cssAdminClearOglRepPhoto(rep_code: $repCode) { ${REP_PROFILE_FIELDS} }
  }
`;

export async function getAdminCompanyPresentation(companyId: number) {
  const data = await graphqlRequest<{ css_admin_company_presentation: CompanyPresentation }, { companyId: number }>(
    ADMIN_PRESENTATION_QUERY,
    { companyId },
  );
  return data.css_admin_company_presentation;
}

export async function getPortalCompanyPresentation() {
  const data = await customerGraphqlRequest<{ css_company_presentation: CompanyPresentation }, Record<string, never>>(
    PORTAL_PRESENTATION_QUERY,
    {},
  );
  return data.css_company_presentation;
}

export async function saveAdminCompanyPresentation(companyId: number, input: CompanyPresentationInput) {
  const variables = { companyId, input };
  const data = await graphqlRequest<{ cssAdminSaveCompanyPresentation: CompanyPresentation }, typeof variables>(
    SAVE_PRESENTATION_MUTATION,
    variables,
  );
  return data.cssAdminSaveCompanyPresentation;
}

export async function uploadAdminCompanyPresentationMedia(
  companyId: number,
  kind: "LOGO" | "BANNER",
  filename: string,
  base64: string,
) {
  const variables = { companyId, kind, input: { filename, base64 } };
  const data = await graphqlRequest<{ cssAdminUploadCompanyPresentationMedia: CompanyPresentation }, typeof variables>(
    UPLOAD_PRESENTATION_MEDIA_MUTATION,
    variables,
  );
  return data.cssAdminUploadCompanyPresentationMedia;
}

export async function clearAdminCompanyPresentationMedia(companyId: number, kind: "LOGO" | "BANNER") {
  const variables = { companyId, kind };
  const data = await graphqlRequest<{ cssAdminClearCompanyPresentationMedia: CompanyPresentation }, typeof variables>(
    CLEAR_PRESENTATION_MEDIA_MUTATION,
    variables,
  );
  return data.cssAdminClearCompanyPresentationMedia;
}

export async function getAdminOglRepProfiles() {
  const data = await graphqlRequest<{ css_admin_ogl_rep_profiles: AdminOglRepProfile[] }, Record<string, never>>(
    REP_PROFILES_QUERY,
    {},
  );
  return data.css_admin_ogl_rep_profiles;
}

export async function saveAdminOglRepProfile(repCode: string, input: OglRepProfileInput) {
  const variables = { repCode, input };
  const data = await graphqlRequest<{ cssAdminSaveOglRepProfile: AdminOglRepProfile }, typeof variables>(
    SAVE_REP_PROFILE_MUTATION,
    variables,
  );
  return data.cssAdminSaveOglRepProfile;
}

export async function uploadAdminOglRepPhoto(repCode: string, filename: string, base64: string) {
  const variables = { repCode, input: { filename, base64 } };
  const data = await graphqlRequest<{ cssAdminUploadOglRepPhoto: AdminOglRepProfile }, typeof variables>(
    UPLOAD_REP_PHOTO_MUTATION,
    variables,
  );
  return data.cssAdminUploadOglRepPhoto;
}

export async function clearAdminOglRepPhoto(repCode: string) {
  const variables = { repCode };
  const data = await graphqlRequest<{ cssAdminClearOglRepPhoto: AdminOglRepProfile }, typeof variables>(
    CLEAR_REP_PHOTO_MUTATION,
    variables,
  );
  return data.cssAdminClearOglRepPhoto;
}

import { graphqlRequest } from "@/lib/graphql/client";

export type CompanyAdminRole = {
  role_id: number;
  name: string;
  sort_order: number;
  allowed_resources: string[];
  user_count: number;
  manageable: boolean;
};

export type CompanyAdminUser = {
  user_id: number;
  customer_id: number;
  firstname: string;
  lastname: string;
  email: string;
  is_company_admin: boolean;
  manager_user_id: number | null;
  approval_type: string;
  approval_threshold: number | null;
  can_checkout: boolean;
  can_approve_credit_orders: boolean;
  can_auto_approve_credit_order: boolean;
  roles: Array<Pick<CompanyAdminRole, "role_id" | "name" | "manageable">>;
};

export type CompanyAdminResource = {
  resource_id: string;
  title: string;
  parent_resource_id: string | null;
  depth: number;
  assignable: boolean;
};

export type CompanyManagement = {
  company_id: number;
  users: CompanyAdminUser[];
  roles: CompanyAdminRole[];
  resources: CompanyAdminResource[];
};

export type CompanyCustomerCandidate = {
  customer_id: number;
  website_id: number;
  firstname: string;
  lastname: string;
  email: string;
  assigned_to_company: boolean;
};

export type CompanyCustomerCandidateSearchResult = {
  total_count: number;
  items: CompanyCustomerCandidate[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

export type SaveCompanyRoleInput = {
  role_id?: number;
  name: string;
  sort_order?: number;
  allowed_resources: string[];
};

export type AddCompanyUserInput = {
  customer_id: number;
  role_id: number;
  manager_id: number | null;
  approval_type: string;
  approval_threshold: number | null;
};

export type UpdateCompanyUserInput = {
  user_id: number;
  role_id: number;
  manager_id: number | null;
  approval_type: string;
  approval_threshold: number | null;
};

type CompanyManagementData = {
  css_admin_company_management: CompanyManagement;
};

type CompanyCustomerCandidatesData = {
  css_admin_company_customer_candidates: CompanyCustomerCandidateSearchResult;
};

type SaveCompanyRoleData = {
  cssAdminSaveCompanyRole: CompanyAdminRole;
};

type DeleteCompanyRoleData = {
  cssAdminDeleteCompanyRole: boolean;
};

type AddCompanyUserData = {
  cssAdminAddCompanyUser: Pick<CompanyAdminUser, "user_id" | "customer_id" | "email">;
};

type UpdateCompanyUserData = {
  cssAdminUpdateCompanyUser: Pick<CompanyAdminUser, "user_id" | "customer_id" | "email">;
};

type RemoveCompanyUserData = {
  cssAdminRemoveCompanyUser: boolean;
};

const COMPANY_MANAGEMENT_QUERY = /* GraphQL */ `
  query AdminCompanyManagement($companyId: Int!) {
    css_admin_company_management(company_id: $companyId) {
      company_id
      users {
        user_id
        customer_id
        firstname
        lastname
        email
        is_company_admin
        manager_user_id
        approval_type
        approval_threshold
        can_checkout
        can_approve_credit_orders
        can_auto_approve_credit_order
        roles {
          role_id
          name
          manageable
        }
      }
      roles {
        role_id
        name
        sort_order
        allowed_resources
        user_count
        manageable
      }
      resources {
        resource_id
        title
        parent_resource_id
        depth
        assignable
      }
    }
  }
`;

const COMPANY_CUSTOMER_CANDIDATES_QUERY = /* GraphQL */ `
  query AdminCompanyCustomerCandidates(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_admin_company_customer_candidates(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        customer_id
        website_id
        firstname
        lastname
        email
        assigned_to_company
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

const SAVE_COMPANY_ROLE_MUTATION = /* GraphQL */ `
  mutation AdminSaveCompanyRole($companyId: Int!, $input: CssSaveCompanyRoleInput!) {
    cssAdminSaveCompanyRole(company_id: $companyId, input: $input) {
      role_id
      name
      sort_order
      allowed_resources
      user_count
      manageable
    }
  }
`;

const DELETE_COMPANY_ROLE_MUTATION = /* GraphQL */ `
  mutation AdminDeleteCompanyRole($companyId: Int!, $roleId: Int!) {
    cssAdminDeleteCompanyRole(company_id: $companyId, role_id: $roleId)
  }
`;

const ADD_COMPANY_USER_MUTATION = /* GraphQL */ `
  mutation AdminAddCompanyUser($companyId: Int!, $input: CssAdminAddCompanyUserInput!) {
    cssAdminAddCompanyUser(company_id: $companyId, input: $input) {
      user_id
      customer_id
      email
    }
  }
`;

const UPDATE_COMPANY_USER_MUTATION = /* GraphQL */ `
  mutation AdminUpdateCompanyUser($companyId: Int!, $input: CssAdminUpdateCompanyUserInput!) {
    cssAdminUpdateCompanyUser(company_id: $companyId, input: $input) {
      user_id
      customer_id
      email
    }
  }
`;

const REMOVE_COMPANY_USER_MUTATION = /* GraphQL */ `
  mutation AdminRemoveCompanyUser($companyId: Int!, $userId: Int!) {
    cssAdminRemoveCompanyUser(company_id: $companyId, user_id: $userId)
  }
`;

export async function getCompanyManagement(companyId: number) {
  const data = await graphqlRequest<CompanyManagementData, { companyId: number }>(
    COMPANY_MANAGEMENT_QUERY,
    { companyId },
  );

  return data.css_admin_company_management;
}

export async function getCompanyCustomerCandidates(
  companyId: number,
  currentPage = 1,
  pageSize = 50,
  search?: string,
) {
  const data = await graphqlRequest<
    CompanyCustomerCandidatesData,
    { companyId: number; currentPage: number; pageSize: number; search: string | null }
  >(
    COMPANY_CUSTOMER_CANDIDATES_QUERY,
    { companyId, currentPage, pageSize, search: search?.trim() || null },
  );

  return data.css_admin_company_customer_candidates;
}

export async function saveCompanyRole(companyId: number, input: SaveCompanyRoleInput) {
  const data = await graphqlRequest<SaveCompanyRoleData, { companyId: number; input: SaveCompanyRoleInput }>(
    SAVE_COMPANY_ROLE_MUTATION,
    { companyId, input },
  );
  return data.cssAdminSaveCompanyRole;
}

export async function deleteCompanyRole(companyId: number, roleId: number) {
  const data = await graphqlRequest<DeleteCompanyRoleData, { companyId: number; roleId: number }>(
    DELETE_COMPANY_ROLE_MUTATION,
    { companyId, roleId },
  );
  return data.cssAdminDeleteCompanyRole;
}

export async function addCompanyUser(companyId: number, input: AddCompanyUserInput) {
  const data = await graphqlRequest<AddCompanyUserData, { companyId: number; input: AddCompanyUserInput }>(
    ADD_COMPANY_USER_MUTATION,
    { companyId, input },
  );
  return data.cssAdminAddCompanyUser;
}

export async function updateCompanyUser(companyId: number, input: UpdateCompanyUserInput) {
  const data = await graphqlRequest<UpdateCompanyUserData, { companyId: number; input: UpdateCompanyUserInput }>(
    UPDATE_COMPANY_USER_MUTATION,
    { companyId, input },
  );
  return data.cssAdminUpdateCompanyUser;
}

export async function removeCompanyUser(companyId: number, userId: number) {
  const data = await graphqlRequest<RemoveCompanyUserData, { companyId: number; userId: number }>(
    REMOVE_COMPANY_USER_MUTATION,
    { companyId, userId },
  );
  return data.cssAdminRemoveCompanyUser;
}

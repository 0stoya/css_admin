import { customerGraphqlRequest } from "@/lib/graphql/customer-client";

export type CompanyPortalMembership = {
  company_id: number;
  company_user_id: number;
  name: string | null;
  reference: string | null;
  active: boolean;
  selected: boolean;
};

export type CompanyPortalContext = {
  authenticated: boolean;
  customer_id: number | null;
  selected_company_id: number | null;
  selected_company_user_id: number | null;
  is_company_customer: boolean;
  is_personal_context: boolean;
  companies: CompanyPortalMembership[];
};

export type CompanyPortalRole = {
  role_id: number;
  name: string;
  sort_order: number;
  allowed_resources: string[];
  user_count: number;
  manageable: boolean;
};

export type CompanyPortalResource = {
  resource_id: string;
  title: string;
  parent_resource_id: string | null;
  depth: number;
  assignable: boolean;
};

export type CompanyPortalUser = {
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
  roles: CompanyPortalRole[];
};

export type CompanyPortalAdministration = {
  company_id: number;
  company_user_id: number;
  is_company_admin: boolean;
  can_view_users: boolean;
  can_manage_users: boolean;
  can_view_roles: boolean;
  can_manage_roles: boolean;
  users: CompanyPortalUser[];
  roles: CompanyPortalRole[];
  resources: CompanyPortalResource[];
};

export type SaveCompanyPortalRoleInput = {
  role_id?: number;
  name: string;
  sort_order?: number;
  allowed_resources: string[];
};

export type AddCompanyPortalUserInput = {
  email: string;
  role_id: number;
  manager_id?: number | null;
  approval_type?: string;
  approval_threshold?: number | null;
};

export type UpdateCompanyPortalUserInput = {
  user_id: number;
  role_id: number;
  manager_id?: number | null;
  approval_type?: string;
  approval_threshold?: number | null;
};

type ContextData = { css_company_context: CompanyPortalContext };
type SelectCompanyData = { cssSelectCompany: CompanyPortalContext };
type AdministrationData = { css_company_admin: CompanyPortalAdministration };
type SaveRoleData = { cssSaveCompanyRole: CompanyPortalRole };
type DeleteRoleData = { cssDeleteCompanyRole: boolean };
type AddUserData = { cssAddCompanyUser: CompanyPortalUser };
type UpdateUserData = { cssUpdateCompanyUser: CompanyPortalUser };
type RemoveUserData = { cssRemoveCompanyUser: boolean };

const CONTEXT_QUERY = /* GraphQL */ `
  query CompanyPortalContext {
    css_company_context {
      authenticated
      customer_id
      selected_company_id
      selected_company_user_id
      is_company_customer
      is_personal_context
      companies {
        company_id
        company_user_id
        name
        reference
        active
        selected
      }
    }
  }
`;

const SELECT_COMPANY_MUTATION = /* GraphQL */ `
  mutation CompanyPortalSelectCompany($companyId: Int!) {
    cssSelectCompany(company_id: $companyId) {
      authenticated
      customer_id
      selected_company_id
      selected_company_user_id
      is_company_customer
      is_personal_context
      companies {
        company_id
        company_user_id
        name
        reference
        active
        selected
      }
    }
  }
`;

const ADMINISTRATION_QUERY = /* GraphQL */ `
  query CompanyPortalAdministration {
    css_company_admin {
      company_id
      company_user_id
      is_company_admin
      can_view_users
      can_manage_users
      can_view_roles
      can_manage_roles
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
          sort_order
          allowed_resources
          user_count
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

const SAVE_ROLE_MUTATION = /* GraphQL */ `
  mutation CompanyPortalSaveRole($input: CssSaveCompanyRoleInput!) {
    cssSaveCompanyRole(input: $input) {
      role_id
      name
      sort_order
      allowed_resources
      user_count
      manageable
    }
  }
`;

const DELETE_ROLE_MUTATION = /* GraphQL */ `
  mutation CompanyPortalDeleteRole($roleId: Int!) {
    cssDeleteCompanyRole(role_id: $roleId)
  }
`;

const ADD_USER_MUTATION = /* GraphQL */ `
  mutation CompanyPortalAddUser($input: CssAddCompanyUserInput!) {
    cssAddCompanyUser(input: $input) {
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
      roles { role_id name sort_order allowed_resources user_count manageable }
    }
  }
`;

const UPDATE_USER_MUTATION = /* GraphQL */ `
  mutation CompanyPortalUpdateUser($input: CssUpdateCompanyUserInput!) {
    cssUpdateCompanyUser(input: $input) {
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
      roles { role_id name sort_order allowed_resources user_count manageable }
    }
  }
`;

const REMOVE_USER_MUTATION = /* GraphQL */ `
  mutation CompanyPortalRemoveUser($userId: Int!) {
    cssRemoveCompanyUser(user_id: $userId)
  }
`;

export async function getCompanyPortalContext() {
  const data = await customerGraphqlRequest<ContextData, Record<string, never>>(CONTEXT_QUERY, {});
  return data.css_company_context;
}

export async function selectCompanyPortalCompany(companyId: number) {
  const data = await customerGraphqlRequest<SelectCompanyData, { companyId: number }>(
    SELECT_COMPANY_MUTATION,
    { companyId },
  );
  return data.cssSelectCompany;
}

export async function getCompanyPortalAdministration() {
  const data = await customerGraphqlRequest<AdministrationData, Record<string, never>>(
    ADMINISTRATION_QUERY,
    {},
  );
  return data.css_company_admin;
}

export async function saveCompanyPortalRole(input: SaveCompanyPortalRoleInput) {
  const data = await customerGraphqlRequest<SaveRoleData, { input: SaveCompanyPortalRoleInput }>(
    SAVE_ROLE_MUTATION,
    { input },
  );
  return data.cssSaveCompanyRole;
}

export async function deleteCompanyPortalRole(roleId: number) {
  const data = await customerGraphqlRequest<DeleteRoleData, { roleId: number }>(
    DELETE_ROLE_MUTATION,
    { roleId },
  );
  return data.cssDeleteCompanyRole;
}

export async function addCompanyPortalUser(input: AddCompanyPortalUserInput) {
  const data = await customerGraphqlRequest<AddUserData, { input: AddCompanyPortalUserInput }>(
    ADD_USER_MUTATION,
    { input },
  );
  return data.cssAddCompanyUser;
}

export async function updateCompanyPortalUser(input: UpdateCompanyPortalUserInput) {
  const data = await customerGraphqlRequest<UpdateUserData, { input: UpdateCompanyPortalUserInput }>(
    UPDATE_USER_MUTATION,
    { input },
  );
  return data.cssUpdateCompanyUser;
}

export async function removeCompanyPortalUser(userId: number) {
  const data = await customerGraphqlRequest<RemoveUserData, { userId: number }>(
    REMOVE_USER_MUTATION,
    { userId },
  );
  return data.cssRemoveCompanyUser;
}

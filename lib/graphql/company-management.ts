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

type CompanyManagementData = {
  css_admin_company_management: CompanyManagement;
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

export async function getCompanyManagement(companyId: number) {
  const data = await graphqlRequest<CompanyManagementData, { companyId: number }>(
    COMPANY_MANAGEMENT_QUERY,
    { companyId },
  );

  return data.css_admin_company_management;
}

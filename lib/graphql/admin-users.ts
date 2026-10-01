import { graphqlRequest } from "@/lib/graphql/client";

export type MagentoAdminUser = {
  user_id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  active: boolean;
};

type AdminUsersData = {
  css_admin_company_options: {
    sales_representatives: MagentoAdminUser[];
  };
};

type CurrentAdminData = {
  css_admin_current_user: MagentoAdminUser;
};

const ADMIN_USERS_QUERY = /* GraphQL */ `
  query AdminMigrationOwners {
    css_admin_company_options {
      sales_representatives {
        user_id
        username
        firstname
        lastname
        email
        active
      }
    }
  }
`;

const CURRENT_ADMIN_QUERY = /* GraphQL */ `
  query AdminCurrentUser {
    css_admin_current_user {
      user_id
      username
      firstname
      lastname
      email
      active
    }
  }
`;

export function magentoAdminDisplayName(admin: MagentoAdminUser) {
  const name = `${admin.firstname} ${admin.lastname}`.trim();
  return name || admin.username || `Admin #${admin.user_id}`;
}

export async function getActiveMagentoAdmins() {
  const data = await graphqlRequest<AdminUsersData, Record<string, never>>(
    ADMIN_USERS_QUERY,
    {},
  );
  return data.css_admin_company_options.sales_representatives.filter((admin) => admin.active);
}

export async function getCurrentMagentoAdmin() {
  const data = await graphqlRequest<CurrentAdminData, Record<string, never>>(
    CURRENT_ADMIN_QUERY,
    {},
  );
  return data.css_admin_current_user;
}

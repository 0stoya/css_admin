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

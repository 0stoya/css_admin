import { customerGraphqlRequest } from "@/lib/graphql/customer-client";
import type {
  CompanyCatalogPolicy,
  RoleCatalogPolicy,
} from "@/lib/graphql/catalog-policy";

export type SaveCompanyPortalCatalogPolicyInput = {
  allow_public_catalog: boolean;
  category_restriction: boolean;
  allowed_category_ids: number[];
  product_restriction: boolean;
  allowed_product_skus: string[];
};

const COMPANY_CATALOG_POLICY_QUERY = /* GraphQL */ `
  query CompanyPortalCatalogPolicy {
    css_company_catalog_policy {
      company_id
      allow_public_catalog
      category_restriction
      allowed_category_ids
      allowed_categories { category_id name path }
      product_restriction
      allowed_product_ids
      allowed_products { product_id sku name }
    }
  }
`;

const ROLE_CATALOG_POLICY_QUERY = /* GraphQL */ `
  query CompanyPortalRoleCatalogPolicy($roleId: Int!, $page: Int!, $search: String) {
    css_company_role_catalog_policy(role_id: $roleId, page: $page, search: $search) {
      company_id
      role_id
      selected_category_ids
      expanded_category_ids
      has_saved_categories
      show_product_grid
      products_count
      preselect_all_products
      allowed_product_ids
      category_tree {
        id label parent_id is_label_duplicated descendant_ids
        children {
          id label parent_id is_label_duplicated descendant_ids
          children {
            id label parent_id is_label_duplicated descendant_ids
            children {
              id label parent_id is_label_duplicated descendant_ids
              children {
                id label parent_id is_label_duplicated descendant_ids
                children {
                  id label parent_id is_label_duplicated descendant_ids
                  children { id label parent_id is_label_duplicated descendant_ids }
                }
              }
            }
          }
        }
      }
      products {
        total_count
        page
        page_size
        preselect_all
        items { id sku name allowed }
      }
    }
  }
`;

const SAVE_COMPANY_CATALOG_POLICY_MUTATION = /* GraphQL */ `
  mutation CompanyPortalSaveCatalogPolicy($input: CssSaveCompanyCatalogPolicyInput!) {
    cssSaveCompanyCatalogPolicy(input: $input) { company_id }
  }
`;

const SAVE_ROLE_CATEGORIES_MUTATION = /* GraphQL */ `
  mutation CompanyPortalSaveRoleCatalogCategories($roleId: Int!, $categoryIds: [Int!]!) {
    cssSaveCompanyRoleCatalogCategories(role_id: $roleId, category_ids: $categoryIds) {
      company_id
      role_id
    }
  }
`;

const SAVE_ROLE_PRODUCTS_MUTATION = /* GraphQL */ `
  mutation CompanyPortalSaveRoleCatalogProducts(
    $roleId: Int!
    $allowedProductIds: [Int!]!
    $preselectAll: Boolean!
    $deselectedProductIds: [Int!]
  ) {
    cssSaveCompanyRoleCatalogProducts(
      role_id: $roleId
      allowed_product_ids: $allowedProductIds
      preselect_all: $preselectAll
      deselected_product_ids: $deselectedProductIds
    ) {
      company_id
      role_id
    }
  }
`;

export async function getCompanyPortalCatalogPolicy() {
  const data = await customerGraphqlRequest<
    { css_company_catalog_policy: CompanyCatalogPolicy },
    Record<string, never>
  >(COMPANY_CATALOG_POLICY_QUERY, {});
  return data.css_company_catalog_policy;
}

export async function getCompanyPortalRoleCatalogPolicy(
  roleId: number,
  page = 1,
  search?: string,
) {
  const data = await customerGraphqlRequest<
    { css_company_role_catalog_policy: RoleCatalogPolicy },
    { roleId: number; page: number; search?: string }
  >(ROLE_CATALOG_POLICY_QUERY, { roleId, page, search });
  return data.css_company_role_catalog_policy;
}

export async function saveCompanyPortalCatalogPolicy(
  input: SaveCompanyPortalCatalogPolicyInput,
) {
  return customerGraphqlRequest<
    { cssSaveCompanyCatalogPolicy: { company_id: number } },
    { input: SaveCompanyPortalCatalogPolicyInput }
  >(SAVE_COMPANY_CATALOG_POLICY_MUTATION, { input });
}

export async function saveCompanyPortalRoleCatalogCategories(
  roleId: number,
  categoryIds: number[],
) {
  return customerGraphqlRequest<
    { cssSaveCompanyRoleCatalogCategories: { company_id: number; role_id: number } },
    { roleId: number; categoryIds: number[] }
  >(SAVE_ROLE_CATEGORIES_MUTATION, { roleId, categoryIds });
}

export async function saveCompanyPortalRoleCatalogProducts(
  roleId: number,
  allowedProductIds: number[],
  preselectAll: boolean,
  deselectedProductIds: number[] = [],
) {
  return customerGraphqlRequest<
    { cssSaveCompanyRoleCatalogProducts: { company_id: number; role_id: number } },
    {
      roleId: number;
      allowedProductIds: number[];
      preselectAll: boolean;
      deselectedProductIds: number[];
    }
  >(SAVE_ROLE_PRODUCTS_MUTATION, {
    roleId,
    allowedProductIds,
    preselectAll,
    deselectedProductIds,
  });
}

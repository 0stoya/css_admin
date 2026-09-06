import { graphqlRequest } from "@/lib/graphql/client";

export type CatalogCategory = {
  category_id: number;
  name: string;
  path: string;
};

export type CatalogProduct = {
  product_id: number;
  sku: string;
  name: string;
};

export type CompanyCatalogPolicy = {
  company_id: number;
  allow_public_catalog: boolean;
  category_restriction: boolean;
  allowed_category_ids: number[];
  allowed_categories: CatalogCategory[];
  product_restriction: boolean;
  allowed_product_ids: number[];
  allowed_products: CatalogProduct[];
};

export type RoleCatalogCategoryNode = {
  id: number;
  label: string;
  parent_id: number;
  is_label_duplicated: boolean;
  descendant_ids: number[];
  children: RoleCatalogCategoryNode[];
};

export type RoleCatalogProduct = {
  id: number;
  sku: string;
  name: string;
  allowed: boolean;
};

export type RoleCatalogProductPage = {
  total_count: number;
  page: number;
  page_size: number;
  preselect_all: boolean;
  items: RoleCatalogProduct[];
};

export type RoleCatalogPolicy = {
  company_id: number;
  role_id: number;
  category_tree: RoleCatalogCategoryNode[];
  selected_category_ids: number[];
  expanded_category_ids: number[];
  has_saved_categories: boolean;
  show_product_grid: boolean;
  products_count: number;
  preselect_all_products: boolean;
  allowed_product_ids: number[];
  products: RoleCatalogProductPage;
};

type CompanyCatalogPolicyData = {
  css_admin_company_catalog_policy: CompanyCatalogPolicy;
};

type RoleCatalogPolicyData = {
  css_admin_role_catalog_policy: RoleCatalogPolicy;
};

export type SaveCompanyCatalogPolicyInput = {
  company_id: number;
  allow_public_catalog: boolean;
  category_restriction: boolean;
  allowed_category_ids: number[];
  product_restriction: boolean;
  allowed_product_skus: string[];
};

function categoryTreeIds(nodes: RoleCatalogCategoryNode[]): number[] {
  return Array.from(
    new Set(
      nodes
        .flatMap((node) => [node.id, ...categoryTreeIds(node.children ?? [])])
        .filter((id) => id > 0),
    ),
  );
}

/**
 * Magento treats a missing saved role-category selection as no extra category restriction.
 * Keep that persistence detail from blocking the independent role-product controls in the UI.
 */
export function normalizeRoleCatalogPolicy(policy: RoleCatalogPolicy): RoleCatalogPolicy {
  if (policy.has_saved_categories) return policy;

  return {
    ...policy,
    selected_category_ids: categoryTreeIds(policy.category_tree),
    has_saved_categories: true,
  };
}

const COMPANY_CATALOG_POLICY_QUERY = /* GraphQL */ `
  query AdminCompanyCatalogPolicy($companyId: Int!) {
    css_admin_company_catalog_policy(company_id: $companyId) {
      company_id
      allow_public_catalog
      category_restriction
      allowed_category_ids
      allowed_categories {
        category_id
        name
        path
      }
      product_restriction
      allowed_product_ids
      allowed_products {
        product_id
        sku
        name
      }
    }
  }
`;

const ROLE_CATALOG_POLICY_QUERY = /* GraphQL */ `
  query AdminRoleCatalogPolicy($companyId: Int!, $roleId: Int!, $page: Int!, $search: String) {
    css_admin_role_catalog_policy(company_id: $companyId, role_id: $roleId, page: $page, search: $search) {
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
        id
        label
        parent_id
        is_label_duplicated
        descendant_ids
        children {
          id
          label
          parent_id
          is_label_duplicated
          descendant_ids
          children {
            id
            label
            parent_id
            is_label_duplicated
            descendant_ids
            children {
              id
              label
              parent_id
              is_label_duplicated
              descendant_ids
              children {
                id
                label
                parent_id
                is_label_duplicated
                descendant_ids
                children {
                  id
                  label
                  parent_id
                  is_label_duplicated
                  descendant_ids
                  children {
                    id
                    label
                    parent_id
                    is_label_duplicated
                    descendant_ids
                  }
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
        items {
          id
          sku
          name
          allowed
        }
      }
    }
  }
`;

const SAVE_COMPANY_CATALOG_POLICY_MUTATION = /* GraphQL */ `
  mutation AdminSaveCompanyCatalogPolicy($input: CssAdminSaveCompanyCatalogPolicyInput!) {
    cssAdminSaveCompanyCatalogPolicy(input: $input) {
      company_id
    }
  }
`;

const SAVE_ROLE_CATEGORIES_MUTATION = /* GraphQL */ `
  mutation AdminSaveRoleCatalogCategories($companyId: Int!, $roleId: Int!, $categoryIds: [Int!]!) {
    cssAdminSaveRoleCatalogCategories(company_id: $companyId, role_id: $roleId, category_ids: $categoryIds) {
      company_id
      role_id
    }
  }
`;

const SAVE_ROLE_PRODUCTS_MUTATION = /* GraphQL */ `
  mutation AdminSaveRoleCatalogProducts(
    $companyId: Int!
    $roleId: Int!
    $allowedProductIds: [Int!]!
    $preselectAll: Boolean!
    $deselectedProductIds: [Int!]
  ) {
    cssAdminSaveRoleCatalogProducts(
      company_id: $companyId
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

export async function getCompanyCatalogPolicy(companyId: number) {
  const data = await graphqlRequest<CompanyCatalogPolicyData, { companyId: number }>(
    COMPANY_CATALOG_POLICY_QUERY,
    { companyId },
  );
  return data.css_admin_company_catalog_policy;
}

export async function getRoleCatalogPolicy(
  companyId: number,
  roleId: number,
  page = 1,
  search?: string,
) {
  const data = await graphqlRequest<
    RoleCatalogPolicyData,
    { companyId: number; roleId: number; page: number; search?: string }
  >(ROLE_CATALOG_POLICY_QUERY, { companyId, roleId, page, search });
  return normalizeRoleCatalogPolicy(data.css_admin_role_catalog_policy);
}

export async function saveCompanyCatalogPolicy(input: SaveCompanyCatalogPolicyInput) {
  await graphqlRequest<
    { cssAdminSaveCompanyCatalogPolicy: { company_id: number } },
    { input: SaveCompanyCatalogPolicyInput }
  >(SAVE_COMPANY_CATALOG_POLICY_MUTATION, { input });
}

export async function saveRoleCatalogCategories(
  companyId: number,
  roleId: number,
  categoryIds: number[],
) {
  await graphqlRequest<
    { cssAdminSaveRoleCatalogCategories: { company_id: number; role_id: number } },
    { companyId: number; roleId: number; categoryIds: number[] }
  >(SAVE_ROLE_CATEGORIES_MUTATION, { companyId, roleId, categoryIds });
}

export async function saveRoleCatalogProducts(
  companyId: number,
  roleId: number,
  allowedProductIds: number[],
  preselectAll: boolean,
  deselectedProductIds: number[] = [],
) {
  await graphqlRequest<
    { cssAdminSaveRoleCatalogProducts: { company_id: number; role_id: number } },
    {
      companyId: number;
      roleId: number;
      allowedProductIds: number[];
      preselectAll: boolean;
      deselectedProductIds: number[];
    }
  >(SAVE_ROLE_PRODUCTS_MUTATION, {
    companyId,
    roleId,
    allowedProductIds,
    preselectAll,
    deselectedProductIds,
  });
}
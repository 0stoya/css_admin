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


type ProductIdsBySkuData = {
  products: {
    items: Array<{
      id: number;
      sku: string;
    }>;
  };
};

const PRODUCT_IDS_BY_SKU_QUERY = /* GraphQL */ `
  query AdminResolveProductIdsBySku(
    $filter: ProductAttributeFilterInput!
    $pageSize: Int!
  ) {
    products(
      filter: $filter
      currentPage: 1
      pageSize: $pageSize
    ) {
      items {
        id
        sku
      }
    }
  }
`;

function normalizedSku(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

export async function resolveProductIdsBySkus(skus: string[]) {
  const unique = [...new Map(
    skus
      .map((sku) => sku.trim())
      .filter(Boolean)
      .map((sku) => [normalizedSku(sku), sku]),
  ).values()];

  const batchSize = 200;
  const batches = Array.from(
    { length: Math.ceil(unique.length / batchSize) },
    (_, index) => unique.slice(index * batchSize, (index + 1) * batchSize),
  );
  const resolved = new Map<string, number>();
  let next = 0;

  async function worker() {
    while (next < batches.length) {
      const index = next;
      next += 1;
      const batch = batches[index];
      const data = await graphqlRequest<
        ProductIdsBySkuData,
        { filter: { sku: { in: string[] } }; pageSize: number }
      >(PRODUCT_IDS_BY_SKU_QUERY, {
        filter: { sku: { in: batch } },
        pageSize: Math.max(1, batch.length),
      });

      for (const product of data.products.items || []) {
        const sku = product.sku?.trim();
        const id = Number(product.id);
        if (!sku || !Number.isInteger(id) || id <= 0) continue;
        resolved.set(normalizedSku(sku), id);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(4, Math.max(1, batches.length)) }, worker),
  );

  return new Map(
    unique
      .map((sku) => [sku, resolved.get(normalizedSku(sku))] as const)
      .filter((entry): entry is readonly [string, number] => typeof entry[1] === "number"),
  );
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
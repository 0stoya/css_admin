"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  saveCompanyCatalogPolicy,
  saveRoleCatalogCategories,
  saveRoleCatalogProducts,
} from "@/lib/graphql/catalog-policy";
import {
  graphQLErrorMessage,
  graphqlRequest,
  GraphQLRequestError,
} from "@/lib/graphql/client";

type RoleControl = "products" | "categories";

type CategoryStateNode = {
  id: number;
  children?: CategoryStateNode[];
};

type AdminRoleCategoryStateData = {
  css_admin_role_catalog_policy: {
    has_saved_categories: boolean;
    category_tree: CategoryStateNode[];
  };
};

const ROLE_CATEGORY_STATE_QUERY = /* GraphQL */ `
  query AdminRoleCategoryState($companyId: Int!, $roleId: Int!) {
    css_admin_role_catalog_policy(company_id: $companyId, role_id: $roleId, page: 1) {
      has_saved_categories
      category_tree {
        id
        children {
          id
          children {
            id
            children {
              id
              children {
                id
                children {
                  id
                  children {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function catalogPath(companyId: number) {
  return `/companies/${companyId}/catalog`;
}

function requiredInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function positiveIntList(raw: string, key: string) {
  if (!raw.trim()) return [];
  const values = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);

  if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error(`${key} must contain only positive integer IDs.`);
  }

  return Array.from(new Set(values));
}

function positiveIntEntries(formData: FormData, key: string) {
  const values = formData
    .getAll(key)
    .flatMap((entry) => String(entry).split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number);

  if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error(`${key} must contain only positive integer IDs.`);
  }

  return Array.from(new Set(values));
}

function stringList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function checked(formData: FormData, key: string) {
  return formData.get(key) !== null;
}

function categoryStateIds(nodes: CategoryStateNode[]): number[] {
  return Array.from(
    new Set(
      nodes
        .flatMap((node) => [node.id, ...categoryStateIds(node.children ?? [])])
        .filter((id) => id > 0),
    ),
  );
}

function isSelectedCategoryProductError(error: unknown) {
  const message = error instanceof GraphQLRequestError
    ? error.message
    : error instanceof Error
      ? error.message
      : "";

  return message
    .toLocaleLowerCase("en")
    .includes("not available for the selected categories");
}

async function saveExplicitRoleProductsWithCompatibility(
  companyId: number,
  roleId: number,
  allowedProductIds: number[],
) {
  try {
    await saveRoleCatalogProducts(companyId, roleId, allowedProductIds, false, []);
    return;
  } catch (error) {
    if (!isSelectedCategoryProductError(error)) throw error;

    const data = await graphqlRequest<
      AdminRoleCategoryStateData,
      { companyId: number; roleId: number }
    >(ROLE_CATEGORY_STATE_QUERY, { companyId, roleId });

    const state = data.css_admin_role_catalog_policy;
    if (state.has_saved_categories) throw error;

    const categoryIds = categoryStateIds(state.category_tree);
    if (!categoryIds.length) throw error;

    // Magento treats a missing role-category record as no extra category restriction.
    // Persist that equivalent state once, then retry the independent product write.
    await saveRoleCatalogCategories(companyId, roleId, categoryIds);
    await saveRoleCatalogProducts(companyId, roleId, allowedProductIds, false, []);
  }
}

async function runMutation(
  companyId: number,
  notice: string,
  work: () => Promise<unknown>,
  roleId?: number,
  roleControl?: RoleControl,
) {
  let errorMessage: string | null = null;

  try {
    await work();
    revalidatePath(catalogPath(companyId));
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = new URLSearchParams();
  if (roleId) {
    params.set("view", "roles");
    params.set("roleId", String(roleId));
    if (roleControl) params.set("roleControl", roleControl);
  }
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  redirect(`${catalogPath(companyId)}?${params.toString()}`);
}

export async function saveCompanyCatalogPolicyAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");

  return runMutation(companyId, "Company catalogue policy saved.", async () => {
    await saveCompanyCatalogPolicy({
      company_id: companyId,
      allow_public_catalog: checked(formData, "allowPublicCatalog"),
      category_restriction: checked(formData, "categoryRestriction"),
      allowed_category_ids: positiveIntList(
        String(formData.get("allowedCategoryIds") ?? ""),
        "allowedCategoryIds",
      ),
      product_restriction: checked(formData, "productRestriction"),
      allowed_product_skus: stringList(String(formData.get("allowedProductSkus") ?? "")),
    });
  });
}

export async function saveRoleCategoriesAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const roleId = requiredInt(formData, "roleId");
  const categoryIds = positiveIntEntries(formData, "categoryIds");

  return runMutation(companyId, "Role catalogue categories saved.", async () => {
    await saveRoleCatalogCategories(companyId, roleId, categoryIds);
  }, roleId, "categories");
}

export async function saveRoleProductsAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const roleId = requiredInt(formData, "roleId");
  const mode = String(formData.get("productMode") ?? "").trim();

  return runMutation(companyId, "Role catalogue products saved.", async () => {
    if (mode === "all") {
      await saveRoleCatalogProducts(companyId, roleId, [], true, []);
      return;
    }

    if (mode !== "explicit") {
      throw new Error("productMode must be all or explicit.");
    }

    const allowedProductIds = positiveIntEntries(formData, "allowedProductIds");
    await saveExplicitRoleProductsWithCompatibility(companyId, roleId, allowedProductIds);
  }, roleId, "products");
}

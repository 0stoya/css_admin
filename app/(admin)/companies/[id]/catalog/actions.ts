"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  saveCompanyCatalogPolicy,
  saveRoleCatalogCategories,
  saveRoleCatalogProducts,
} from "@/lib/graphql/catalog-policy";
import { graphQLErrorMessage } from "@/lib/graphql/client";

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

async function runMutation(
  companyId: number,
  notice: string,
  work: () => Promise<unknown>,
  roleId?: number,
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
  }, roleId);
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
    await saveRoleCatalogProducts(companyId, roleId, allowedProductIds, false, []);
  }, roleId);
}

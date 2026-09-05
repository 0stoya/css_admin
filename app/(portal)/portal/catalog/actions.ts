"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  saveCompanyPortalCatalogPolicy,
  saveCompanyPortalRoleCatalogCategories,
  saveCompanyPortalRoleCatalogProducts,
} from "@/lib/graphql/company-portal-catalog";

const CATALOG_PATH = "/portal/catalog";

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
  const values = raw.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean).map(Number);
  if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error(`${key} must contain only positive integer IDs.`);
  }
  return Array.from(new Set(values));
}

function positiveIntEntries(formData: FormData, key: string) {
  return positiveIntList(formData.getAll(key).map(String).join(","), key);
}

function stringList(raw: string) {
  return Array.from(new Set(raw.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean)));
}

async function runMutation(notice: string, work: () => Promise<unknown>, roleId?: number) {
  let errorMessage: string | null = null;
  try {
    await work();
    revalidatePath(CATALOG_PATH);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = new URLSearchParams();
  if (roleId) params.set("roleId", String(roleId));
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  redirect(`${CATALOG_PATH}?${params.toString()}`);
}

export async function savePortalCompanyCatalogPolicyAction(formData: FormData) {
  return runMutation("Company catalogue policy saved.", async () => {
    await saveCompanyPortalCatalogPolicy({
      allow_public_catalog: formData.get("allowPublicCatalog") !== null,
      category_restriction: formData.get("categoryRestriction") !== null,
      allowed_category_ids: positiveIntList(
        String(formData.get("allowedCategoryIds") ?? ""),
        "allowedCategoryIds",
      ),
      product_restriction: formData.get("productRestriction") !== null,
      allowed_product_skus: stringList(String(formData.get("allowedProductSkus") ?? "")),
    });
  });
}

export async function savePortalRoleCategoriesAction(formData: FormData) {
  const roleId = requiredInt(formData, "roleId");
  return runMutation("Role catalogue categories saved.", async () => {
    await saveCompanyPortalRoleCatalogCategories(
      roleId,
      positiveIntEntries(formData, "categoryIds"),
    );
  }, roleId);
}

export async function savePortalRoleProductsAction(formData: FormData) {
  const roleId = requiredInt(formData, "roleId");
  const mode = String(formData.get("productMode") ?? "").trim();

  return runMutation("Role catalogue products saved.", async () => {
    if (mode === "all") {
      await saveCompanyPortalRoleCatalogProducts(roleId, [], true);
      return;
    }
    if (mode !== "explicit") throw new Error("productMode must be all or explicit.");
    await saveCompanyPortalRoleCatalogProducts(
      roleId,
      positiveIntEntries(formData, "allowedProductIds"),
      false,
    );
  }, roleId);
}

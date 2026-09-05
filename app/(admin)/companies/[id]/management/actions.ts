"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addCompanyUser,
  deleteCompanyRole,
  removeCompanyUser,
  saveCompanyRole,
  updateCompanyUser,
} from "@/lib/graphql/company-management";
import { graphQLErrorMessage } from "@/lib/graphql/client";

const APPROVAL_TYPES = new Set(["all", "template", "value", "none"]);

function managementPath(companyId: number) {
  return `/companies/${companyId}/management`;
}

function requiredInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function nullableInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer when supplied.`);
  }
  return value;
}

function optionalInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer when supplied.`);
  }
  return value;
}

function nullableFloat(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number when supplied.`);
  }
  return value;
}

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function approvalType(formData: FormData) {
  const value = String(formData.get("approvalType") ?? "all").trim().toLowerCase() || "all";
  if (!APPROVAL_TYPES.has(value)) {
    throw new Error("Approval type must be All, Template, Value, or None.");
  }
  return value;
}

async function runMutation(companyId: number, notice: string, work: () => Promise<unknown>) {
  let errorMessage: string | null = null;

  try {
    await work();
    revalidatePath(managementPath(companyId));
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  const params = new URLSearchParams();
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", notice);
  redirect(`${managementPath(companyId)}?${params.toString()}`);
}

export async function addCompanyUserAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");

  return runMutation(companyId, "Company user added.", async () => {
    await addCompanyUser(companyId, {
      customer_id: requiredInt(formData, "customerId"),
      role_id: requiredInt(formData, "roleId"),
      manager_id: nullableInt(formData, "managerId"),
      approval_type: approvalType(formData),
      approval_threshold: nullableFloat(formData, "approvalThreshold"),
    });
  });
}

export async function updateCompanyUserAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");

  return runMutation(companyId, "Company user updated.", async () => {
    await updateCompanyUser(companyId, {
      user_id: requiredInt(formData, "userId"),
      role_id: requiredInt(formData, "roleId"),
      manager_id: nullableInt(formData, "managerId"),
      approval_type: approvalType(formData),
      approval_threshold: nullableFloat(formData, "approvalThreshold"),
    });
  });
}

export async function removeCompanyUserAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const userId = requiredInt(formData, "userId");
  const expectedEmail = requiredString(formData, "expectedEmail");
  const confirmEmail = requiredString(formData, "confirmEmail");

  return runMutation(companyId, "Company user removed.", async () => {
    if (confirmEmail !== expectedEmail) {
      throw new Error("Type the user's exact email address to confirm removal.");
    }
    await removeCompanyUser(companyId, userId);
  });
}

export async function saveCompanyRoleAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const roleId = nullableInt(formData, "roleId") ?? undefined;
  const roleName = requiredString(formData, "name");

  return runMutation(companyId, roleId ? "Company role updated." : "Company role created.", async () => {
    await saveCompanyRole(companyId, {
      role_id: roleId,
      name: roleName,
      sort_order: optionalInt(formData, "sortOrder"),
      allowed_resources: formData.getAll("allowedResources").map(String),
    });
  });
}

export async function deleteCompanyRoleAction(formData: FormData) {
  const companyId = requiredInt(formData, "companyId");
  const roleId = requiredInt(formData, "roleId");
  const expectedName = requiredString(formData, "expectedName");
  const confirmName = requiredString(formData, "confirmName");

  return runMutation(companyId, "Company role deleted.", async () => {
    if (confirmName !== expectedName) {
      throw new Error("Type the exact role name to confirm deletion.");
    }
    await deleteCompanyRole(companyId, roleId);
  });
}

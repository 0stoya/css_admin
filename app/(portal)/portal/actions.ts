"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  deleteCompanyPortalRole,
  getCompanyPortalAdministration,
  removeCompanyPortalUser,
  saveCompanyPortalRole,
  selectCompanyPortalCompany,
  updateCompanyPortalUser,
} from "@/lib/graphql/company-portal";

function positiveInt(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(String(value ?? ""));
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive ID.`);
  }
  return parsed;
}

function optionalInt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) throw new Error("Enter a whole number.");
  return parsed;
}

function nullablePositiveInt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return positiveInt(value, "Manager");
}

function nullableNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error("Enter a numeric approval threshold.");
  return parsed;
}

async function runPortalMutation(success: string, mutation: () => Promise<unknown>) {
  let errorMessage: string | null = null;

  try {
    await mutation();
    revalidatePath("/portal");
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  if (errorMessage) {
    redirect(`/portal?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/portal?success=${encodeURIComponent(success)}`);
}

export async function selectPortalCompanyAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const companyId = positiveInt(formData.get("companyId"), "Company");
    await selectCompanyPortalCompany(companyId);
    revalidatePath("/portal");
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  if (errorMessage) {
    redirect(`/portal?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/portal");
}

export async function savePortalRoleAction(formData: FormData) {
  await runPortalMutation("Company role saved.", async () => {
    const roleId = optionalInt(formData.get("roleId"));
    const sortOrder = optionalInt(formData.get("sortOrder"));
    const name = String(formData.get("name") ?? "").trim();
    const allowedResources = formData
      .getAll("allowedResources")
      .map((value) => String(value).trim())
      .filter(Boolean);

    await saveCompanyPortalRole({
      ...(roleId === undefined ? {} : { role_id: roleId }),
      name,
      ...(sortOrder === undefined ? {} : { sort_order: sortOrder }),
      allowed_resources: allowedResources,
    });
  });
}

export async function deletePortalRoleAction(formData: FormData) {
  await runPortalMutation("Company role deleted.", async () => {
    const roleId = positiveInt(formData.get("roleId"), "Role");
    const confirmation = String(formData.get("confirmRoleName") ?? "").trim();
    const administration = await getCompanyPortalAdministration();
    const role = administration.roles.find((item) => item.role_id === roleId);

    if (!role) throw new Error("The role is no longer available in the selected company.");
    if (confirmation !== role.name) throw new Error(`Enter ${role.name} exactly to delete this role.`);

    await deleteCompanyPortalRole(roleId);
  });
}

export async function updatePortalUserAction(formData: FormData) {
  await runPortalMutation("Company user saved.", async () => {
    const userId = positiveInt(formData.get("userId"), "User");
    const roleId = positiveInt(formData.get("roleId"), "Role");
    const managerId = nullablePositiveInt(formData.get("managerId"));
    const approvalType = String(formData.get("approvalType") ?? "").trim();
    const approvalThreshold = nullableNumber(formData.get("approvalThreshold"));

    await updateCompanyPortalUser({
      user_id: userId,
      role_id: roleId,
      manager_id: managerId,
      ...(approvalType ? { approval_type: approvalType } : {}),
      approval_threshold: approvalThreshold,
    });
  });
}

export async function removePortalUserAction(formData: FormData) {
  await runPortalMutation("Company user removed.", async () => {
    const userId = positiveInt(formData.get("userId"), "User");
    const confirmation = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
    const administration = await getCompanyPortalAdministration();
    const user = administration.users.find((item) => item.user_id === userId);

    if (!user) throw new Error("The user is no longer available in the selected company.");
    if (confirmation !== user.email.toLowerCase()) {
      throw new Error(`Enter ${user.email} exactly to remove this company user.`);
    }

    await removeCompanyPortalUser(userId);
  });
}

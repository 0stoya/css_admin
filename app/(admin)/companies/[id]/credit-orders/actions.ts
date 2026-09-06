"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  addAdminCreditOrderComment,
  approveAdminCreditOrder,
  cancelAdminCreditOrder,
  placeAdminCreditOrder,
  rejectAdminCreditOrder,
  type AdminCreditOrderActionInput,
} from "@/lib/graphql/admin-credit-orders";

function requiredPositiveInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
}

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function returnView(formData: FormData, fallback = "overview") {
  const value = String(formData.get("returnView") ?? fallback).trim();
  return value === "conversation" || value === "history" ? value : "overview";
}

function revalidateCreditOrder(companyId: number, number: string) {
  revalidatePath(`/companies/${companyId}/credit-orders`);
  revalidatePath(`/companies/${companyId}/credit-orders/${encodeURIComponent(number)}`);
  revalidatePath(`/companies/${companyId}`);
}

function detailRedirect(companyId: number, number: string, actorCompanyUserId: number, view: string, errorMessage: string | null, successMessage: string) {
  const params = new URLSearchParams({ actor: String(actorCompanyUserId) });
  if (view !== "overview") params.set("view", view);
  if (errorMessage) params.set("error", errorMessage);
  else params.set("notice", successMessage);
  redirect(`/companies/${companyId}/credit-orders/${encodeURIComponent(number)}?${params.toString()}`);
}

async function runAction(
  formData: FormData,
  action: (input: AdminCreditOrderActionInput) => Promise<unknown>,
  successMessage: string,
  requireConfirmation = false,
) {
  const companyId = requiredPositiveInt(formData, "companyId");
  const actorCompanyUserId = requiredPositiveInt(formData, "actorCompanyUserId");
  const number = requiredString(formData, "number");
  const view = returnView(formData);
  let errorMessage: string | null = null;

  if (requireConfirmation) {
    const confirmation = String(formData.get("confirmNumber") ?? "").trim();
    if (confirmation !== number) errorMessage = `Type the exact credit-order number ${number} to continue.`;
  }

  if (!errorMessage) {
    try {
      await action({
        company_id: companyId,
        number,
        actor_company_user_id: actorCompanyUserId,
        comment: String(formData.get("comment") ?? "").trim() || null,
      });
      revalidateCreditOrder(companyId, number);
    } catch (error) {
      errorMessage = graphQLErrorMessage(error);
    }
  }

  detailRedirect(companyId, number, actorCompanyUserId, view, errorMessage, successMessage);
}

export async function approveCreditOrderAction(formData: FormData) {
  return runAction(formData, approveAdminCreditOrder, "Credit order approval submitted.");
}

export async function rejectCreditOrderAction(formData: FormData) {
  return runAction(formData, rejectAdminCreditOrder, "Credit order rejected.", true);
}

export async function cancelCreditOrderAction(formData: FormData) {
  return runAction(formData, cancelAdminCreditOrder, "Credit order canceled.", true);
}

export async function placeCreditOrderAction(formData: FormData) {
  return runAction(formData, placeAdminCreditOrder, "Sales-order placement submitted.", true);
}

export async function addCreditOrderCommentAction(formData: FormData) {
  const companyId = requiredPositiveInt(formData, "companyId");
  const actorCompanyUserId = requiredPositiveInt(formData, "actorCompanyUserId");
  const number = requiredString(formData, "number");
  const view = returnView(formData, "conversation");
  let errorMessage: string | null = null;

  try {
    await addAdminCreditOrderComment({
      company_id: companyId,
      number,
      actor_company_user_id: actorCompanyUserId,
      comment: String(formData.get("comment") ?? "").trim(),
    });
    revalidateCreditOrder(companyId, number);
  } catch (error) {
    errorMessage = graphQLErrorMessage(error);
  }

  detailRedirect(companyId, number, actorCompanyUserId, view, errorMessage, "Comment added.");
}

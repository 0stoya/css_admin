"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  clearAdminCompanyPresentationMedia,
  saveAdminCompanyPresentation,
  uploadAdminCompanyPresentationMedia,
} from "@/lib/graphql/company-presentation";

const MAX_MEDIA_BYTES = 3 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function companyIdFrom(formData: FormData) {
  const value = Number(formData.get("companyId"));
  if (!Number.isInteger(value) || value < 1) throw new Error("companyId must be a positive integer.");
  return value;
}

function nullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function target(companyId: number) {
  return `/companies/${companyId}/personalisation`;
}

function finish(companyId: number, key: "notice" | "error", message: string): never {
  revalidatePath(target(companyId));
  redirect(`${target(companyId)}?${key}=${encodeURIComponent(message)}`);
}

function mediaFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File) || value.size < 1) throw new Error("Choose an image to upload.");
  if (value.size > MAX_MEDIA_BYTES) throw new Error("Images must be 3 MB or smaller.");
  if (!ALLOWED_MEDIA_TYPES.has(value.type)) throw new Error("Images must be JPEG, PNG, or WebP.");
  return value;
}

export async function saveCompanyPresentationAction(formData: FormData) {
  const companyId = companyIdFrom(formData);
  try {
    await saveAdminCompanyPresentation(companyId, {
      enabled: formData.get("enabled") === "on",
      portal_title: nullableString(formData, "portalTitle"),
      welcome_heading: nullableString(formData, "welcomeHeading"),
      welcome_text: nullableString(formData, "welcomeText"),
      company_description: nullableString(formData, "companyDescription"),
      contact_phone: nullableString(formData, "contactPhone"),
      contact_email: nullableString(formData, "contactEmail"),
      procurement_email: nullableString(formData, "procurementEmail"),
    });
    finish(companyId, "notice", "Company personalisation saved.");
  } catch (error) {
    finish(companyId, "error", graphQLErrorMessage(error));
  }
}

export async function uploadCompanyPresentationMediaAction(formData: FormData) {
  const companyId = companyIdFrom(formData);
  try {
    const kind = String(formData.get("kind") ?? "").toUpperCase();
    if (kind !== "LOGO" && kind !== "BANNER") throw new Error("Invalid company media kind.");
    const file = mediaFile(formData);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    await uploadAdminCompanyPresentationMedia(companyId, kind, file.name, base64);
    finish(companyId, "notice", `${kind === "LOGO" ? "Logo" : "Banner"} uploaded.`);
  } catch (error) {
    finish(companyId, "error", graphQLErrorMessage(error));
  }
}

export async function clearCompanyPresentationMediaAction(formData: FormData) {
  const companyId = companyIdFrom(formData);
  try {
    const kind = String(formData.get("kind") ?? "").toUpperCase();
    if (kind !== "LOGO" && kind !== "BANNER") throw new Error("Invalid company media kind.");
    await clearAdminCompanyPresentationMedia(companyId, kind);
    finish(companyId, "notice", `${kind === "LOGO" ? "Logo" : "Banner"} removed.`);
  } catch (error) {
    finish(companyId, "error", graphQLErrorMessage(error));
  }
}

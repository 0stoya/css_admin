"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  clearAdminOglRepPhoto,
  saveAdminOglRepProfile,
  uploadAdminOglRepPhoto,
} from "@/lib/graphql/company-presentation";

const TARGET = "/ogl/rep-profiles";
const MAX_MEDIA_BYTES = 3 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function finish(key: "notice" | "error", message: string): never {
  revalidatePath(TARGET);
  redirect(`${TARGET}?${key}=${encodeURIComponent(message)}`);
}

function mediaFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File) || value.size < 1) throw new Error("Choose a profile image to upload.");
  if (value.size > MAX_MEDIA_BYTES) throw new Error("Images must be 3 MB or smaller.");
  if (!ALLOWED_MEDIA_TYPES.has(value.type)) throw new Error("Images must be JPEG, PNG, or WebP.");
  return value;
}

export async function saveOglRepProfileAction(formData: FormData) {
  const repCode = requiredString(formData, "repCode");
  try {
    await saveAdminOglRepProfile(repCode, {
      profile_active: formData.get("profileActive") === "on",
      job_title: optionalString(formData, "jobTitle"),
      phone: optionalString(formData, "phone"),
      mobile: optionalString(formData, "mobile"),
      display_email: optionalString(formData, "displayEmail"),
      profile_message: optionalString(formData, "profileMessage"),
    });
    finish("notice", `Saved presentation profile for ${repCode}.`);
  } catch (error) {
    finish("error", graphQLErrorMessage(error));
  }
}

export async function uploadOglRepPhotoAction(formData: FormData) {
  const repCode = requiredString(formData, "repCode");
  try {
    const file = mediaFile(formData);
    await uploadAdminOglRepPhoto(repCode, file.name, Buffer.from(await file.arrayBuffer()).toString("base64"));
    finish("notice", `Uploaded profile photo for ${repCode}.`);
  } catch (error) {
    finish("error", graphQLErrorMessage(error));
  }
}

export async function clearOglRepPhotoAction(formData: FormData) {
  const repCode = requiredString(formData, "repCode");
  try {
    await clearAdminOglRepPhoto(repCode);
    finish("notice", `Removed profile photo for ${repCode}.`);
  } catch (error) {
    finish("error", graphQLErrorMessage(error));
  }
}

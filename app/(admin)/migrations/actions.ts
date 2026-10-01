"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPortalMigration,
  updatePortalMigration,
  updatePortalMigrationTask,
} from "@/lib/portal-migrations";
import { getAdminToken } from "@/lib/session";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function requiredMigrationId(formData: FormData) {
  const raw = value(formData, "migrationId");
  const migrationId = Number(raw);
  if (!raw || !Number.isInteger(migrationId) || migrationId <= 0) {
    throw new Error("Migration id must be a positive integer.");
  }
  return migrationId;
}

async function requireAdminSession() {
  if (!(await getAdminToken())) {
    redirect("/login");
  }
}

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected portal migration error.";
  if (
    message.includes("portal_migration_root_company_ref_unique")
    || message.includes("duplicate key value")
  ) {
    return "A migration already exists for that root company reference.";
  }
  if (message.includes("does not exist") && message.includes("portal_migration")) {
    return "Portal migration storage is not initialized on this server yet.";
  }
  return message;
}

function redirectWithMessage(path: string, notice: string | null, error: string | null): never {
  const params = new URLSearchParams();
  if (notice) params.set("notice", notice);
  if (error) params.set("error", error);
  const query = params.toString();
  redirect(query ? `${path}?${query}` : path);
}

export async function createPortalMigrationAction(formData: FormData) {
  await requireAdminSession();

  let migrationId: number | null = null;
  let error: string | null = null;

  try {
    migrationId = await createPortalMigration({
      name: value(formData, "name"),
      rootCompanyRef: value(formData, "rootCompanyRef"),
      ownerName: value(formData, "ownerName"),
      targetDate: value(formData, "targetDate"),
      notes: value(formData, "notes"),
    });
    revalidatePath("/migrations");
  } catch (caught) {
    error = messageFor(caught);
  }

  if (migrationId !== null) {
    redirectWithMessage(
      `/migrations/${migrationId}`,
      "Migration created with the standard portal checklist.",
      null,
    );
  }

  redirectWithMessage("/migrations", null, error ?? "Migration could not be created.");
}

export async function updatePortalMigrationAction(formData: FormData) {
  await requireAdminSession();

  let migrationId: number;
  try {
    migrationId = requiredMigrationId(formData);
  } catch (caught) {
    redirectWithMessage("/migrations", null, messageFor(caught));
  }

  let error: string | null = null;
  try {
    await updatePortalMigration({
      id: migrationId!,
      ownerName: value(formData, "ownerName"),
      stage: value(formData, "stage"),
      targetDate: value(formData, "targetDate"),
      notes: value(formData, "notes"),
    });
    revalidatePath("/migrations");
    revalidatePath(`/migrations/${migrationId!}`);
  } catch (caught) {
    error = messageFor(caught);
  }

  redirectWithMessage(
    `/migrations/${migrationId!}`,
    error ? null : "Migration details updated.",
    error,
  );
}

export async function updatePortalMigrationTaskAction(formData: FormData) {
  await requireAdminSession();

  let migrationId: number;
  try {
    migrationId = requiredMigrationId(formData);
  } catch (caught) {
    redirectWithMessage("/migrations", null, messageFor(caught));
  }

  let error: string | null = null;
  try {
    await updatePortalMigrationTask({
      migrationId: migrationId!,
      taskKey: value(formData, "taskKey"),
      status: value(formData, "status"),
      ownerName: value(formData, "ownerName"),
      note: value(formData, "note"),
    });
    revalidatePath("/migrations");
    revalidatePath(`/migrations/${migrationId!}`);
  } catch (caught) {
    error = messageFor(caught);
  }

  redirectWithMessage(
    `/migrations/${migrationId!}`,
    error ? null : "Checklist item updated.",
    error,
  );
}

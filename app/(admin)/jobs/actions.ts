"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { allowedStructureCompanies, currentStaffJobIdentity } from "@/lib/admin-job-auth";
import {
  acknowledgeOwnerExportJobs, cancelQueuedOwnerExportJob, enqueueStructureExport, enqueueBulkExport, hasExportJobStore,
} from "@/lib/admin-export-jobs";
import { getAllCompanies } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { isBulkExportKind, prepareBulkCompanies } from "@/lib/bulk-export-csv";

function safeMessage(error: unknown) {
  // No GraphQL payload, personal data or credentials in query strings.
  const message = graphQLErrorMessage(error);
  if (/three pending export jobs/i.test(message)) return "You already have three pending exports.";
  if (/at most 80/i.test(message)) return "Group exports currently support up to 80 companies.";
  if (/company structure/i.test(message)) return "This company has no complete, visible structure.";
  if (/no longer waiting/i.test(message)) return "This export has already started or finished.";
  if (/duplicate company references/i.test(message)) return "Company references must be unique for this export.";
  if (/out-of-scope parent/i.test(message)) return "Company structure includes a parent outside your accessible companies.";
  if (/no referenced companies/i.test(message)) return "There are no referenced companies to export.";
  if (/10,000 companies/i.test(message)) return "This export exceeds the 10,000 company limit.";
  return "The export request could not be completed. Please try again.";
}

export async function queueStructureSnapshotAction(formData: FormData) {
  const raw = String(formData.get("companyId") ?? "");
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1) {
    redirect("/jobs?error=Invalid+company+ID");
  }
  let errorMessage: string | null = null;
  try {
    const [actor, visible] = await Promise.all([
      currentStaffJobIdentity(), getAllCompanies(),
    ]);
    const { root, companies } = allowedStructureCompanies(visible, id);
    await enqueueStructureExport(actor.user_id, id, root, companies);
  } catch (error) {
    errorMessage = safeMessage(error);
  }
  if (errorMessage) redirect("/jobs?error=" + encodeURIComponent(errorMessage));
  revalidatePath("/jobs");
  redirect("/jobs?queued=1");
}

export async function queueBulkExportAction(formData: FormData) {
  if (!hasExportJobStore()) redirect("/jobs?error=Background+exports+are+not+configured");
  const kind = String(formData.get("exportKind") ?? "");
  if (!isBulkExportKind(kind)) redirect("/jobs?error=Invalid+bulk+export+type");
  let errorMessage: string | null = null;
  try {
    // Capture only the initiating Staff Admin's currently visible company IDs.
    // The long-running worker must never widen this approved scope.
    const [actor, visible] = await Promise.all([
      currentStaffJobIdentity(), getAllCompanies(),
    ]);
    const companies = prepareBulkCompanies(kind, visible);
    await enqueueBulkExport(actor.user_id, kind, companies);
  } catch (error) {
    errorMessage = safeMessage(error);
  }
  if (errorMessage) redirect("/jobs?error=" + encodeURIComponent(errorMessage));
  revalidatePath("/jobs");
  redirect("/jobs?queued=1");
}

export async function markExportJobsReadAction() {
  const actor = await currentStaffJobIdentity();
  await acknowledgeOwnerExportJobs(actor.user_id);
  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function cancelQueuedExportAction(formData: FormData) {
  const id = String(formData.get("jobId") ?? "");
  const actor = await currentStaffJobIdentity();
  let errorMessage: string | null = null;
  try {
    await cancelQueuedOwnerExportJob(actor.user_id, id);
  } catch (error) {
    errorMessage = safeMessage(error);
  }
  revalidatePath("/jobs");
  redirect(errorMessage ? "/jobs?error=" + encodeURIComponent(errorMessage) : "/jobs");
}

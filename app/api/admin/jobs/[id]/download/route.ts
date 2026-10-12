import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { currentStaffJobIdentity, ensureJobDownloadScope } from "@/lib/admin-job-auth";
import { getOwnerExportJob } from "@/lib/admin-export-jobs";
import { GraphQLRequestError } from "@/lib/graphql/client";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const uuid = "[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}";
const artifactName = new RegExp("^(" + uuid + ")-(" + uuid + ")\\.xlsx$", "i");

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const actor = await currentStaffJobIdentity();
    const job = await getOwnerExportJob(actor.user_id, id);
    if (!job) return new Response("Export not found.", { status: 404, headers: noStore });
    if (job.status !== "ready" || !job.expires_at || Date.parse(job.expires_at) <= Date.now()) {
      return new Response("Export is not ready, or its download has expired.", { status: 410, headers: noStore });
    }
    await ensureJobDownloadScope(job.root_company_id, job.company_ids);
    const exportDir = process.env.CSS_ADMIN_EXPORT_DIR?.trim();
    if (!exportDir || !exportDir.startsWith("/") || exportDir === "/" || exportDir.includes("..")) {
      return new Response("Export file storage is not configured.", { status: 503, headers: noStore });
    }
    const match = artifactName.exec(job.artifact_name ?? "");
    if (!match || match[1].toLowerCase() !== job.id.toLowerCase()) {
      return new Response("Invalid export artifact.", { status: 500, headers: noStore });
    }
    const path = join(exportDir, job.artifact_name!);
    const meta = await lstat(path);
    if (!meta.isFile() || meta.isSymbolicLink() || meta.size < 1 || meta.size > 75 * 1024 * 1024 ||
        meta.size !== job.artifact_bytes) {
      return new Response("Export file verification failed.", { status: 500, headers: noStore });
    }
    const contents = await readFile(path);
    const safeRef = job.root_reference.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
    const filename = "company-structure-" + safeRef + "-" + job.id.slice(0, 8) + ".xlsx";
    return new Response(Uint8Array.from(contents), {
      headers: {
        ...noStore,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Length": String(contents.byteLength),
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.status === 401) {
      return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
    }
    // The owner is rechecked AND current company scope is verified before IO.
    return new Response("Export unavailable or you no longer have access.", { status: 403, headers: noStore });
  }
}

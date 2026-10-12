import { randomUUID } from "node:crypto";
import { getLocalPostgres, hasLocalPostgres } from "@/lib/local-postgres";
import type { CompanySummary } from "@/lib/graphql/companies";

export type ExportJobStatus = "queued" | "running" | "ready" | "failed" | "cancelled" | "expired";
export type ExportJob = {
  id: string;
  owner_admin_user_id: number;
  requested_company_id: number;
  root_company_id: number;
  root_reference: string;
  root_name: string;
  company_ids: number[];
  status: ExportJobStatus;
  completed_companies: number;
  total_companies: number;
  attempts: number;
  error_message: string | null;
  artifact_name: string | null;
  artifact_bytes: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  acknowledged_at: string | null;
};

type DbJob = Omit<ExportJob, "created_at" | "started_at" | "finished_at" | "expires_at" | "acknowledged_at"> & {
  created_at: Date | string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  expires_at: Date | string | null;
  acknowledged_at: Date | string | null;
};

const iso = (value: Date | string | null) =>
  value === null ? null : (value instanceof Date ? value.toISOString() : String(value));

function publicJob(row: DbJob): ExportJob {
  return {
    ...row,
    company_ids: row.company_ids.map(Number),
    artifact_bytes: row.artifact_bytes === null ? null : Number(row.artifact_bytes),
    created_at: iso(row.created_at)!,
    started_at: iso(row.started_at),
    finished_at: iso(row.finished_at),
    expires_at: iso(row.expires_at),
    acknowledged_at: iso(row.acknowledged_at),
  };
}

// Separate enablement gate: finance PostgreSQL may exist before the job migration
// and worker have been provisioned. No queue links appear until explicitly enabled.
export function hasExportJobStore() {
  return hasLocalPostgres() && process.env.CSS_ADMIN_EXPORT_JOBS_ENABLED === "1";
}

export async function enqueueStructureExport(
  ownerId: number, requestedCompanyId: number, root: CompanySummary, companies: CompanySummary[],
) {
  if (companies.length < 2 || companies.length > 80 ||
    !companies.some(company => company.company_id === root.company_id)) {
    throw new Error("Invalid company structure export scope.");
  }
  const companyIds = companies.map(company => company.company_id);
  if (new Set(companyIds).size !== companyIds.length) throw new Error("Duplicate companies in export.");
  const sql = getLocalPostgres();
  const id = randomUUID();
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(43532026, ${ownerId})`;
    const count = await tx`
      SELECT count(*)::integer AS total FROM css_admin.export_job
      WHERE owner_admin_user_id = ${ownerId}
        AND status IN ('queued', 'running')
    `;
    if (Number(count[0].total) >= 3) {
      throw new Error("You already have three pending export jobs. Let one finish before requesting another.");
    }
    await tx`
      INSERT INTO css_admin.export_job (
        id, owner_admin_user_id, requested_company_id,
        root_company_id, root_reference, root_name,
        company_ids, total_companies
      ) VALUES (
        ${id}, ${ownerId}, ${requestedCompanyId},
        ${root.company_id}, ${root.reference || "Company " + root.company_id},
        ${root.name}, ${sql.array(companyIds)}, ${companies.length}
      )
    `;
  });
  return id;
}

export async function listOwnerExportJobs(ownerId: number): Promise<ExportJob[]> {
  const sql = getLocalPostgres();
  const rows = await sql<DbJob[]>`
    SELECT id, owner_admin_user_id, requested_company_id,
      root_company_id, root_reference, root_name, company_ids,
      status, completed_companies, total_companies, attempts,
      error_message, artifact_name, artifact_bytes,
      created_at, started_at, finished_at, expires_at, acknowledged_at
    FROM css_admin.export_job
    WHERE owner_admin_user_id = ${ownerId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows.map(publicJob);
}

export async function getOwnerExportJob(ownerId: number, id: string): Promise<ExportJob | null> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return null;
  const sql = getLocalPostgres();
  const rows = await sql<DbJob[]>`
    SELECT id, owner_admin_user_id, requested_company_id,
      root_company_id, root_reference, root_name, company_ids,
      status, completed_companies, total_companies, attempts,
      error_message, artifact_name, artifact_bytes,
      created_at, started_at, finished_at, expires_at, acknowledged_at
    FROM css_admin.export_job
    WHERE id = ${id} AND owner_admin_user_id = ${ownerId}
    LIMIT 1
  `;
  return rows[0] ? publicJob(rows[0]) : null;
}

export async function ownerReadyNotifications(ownerId: number) {
  const sql = getLocalPostgres();
  const rows = await sql<{ id: string; root_reference: string; finished_at: Date | string }[]>`
    SELECT id, root_reference, finished_at
    FROM css_admin.export_job
    WHERE owner_admin_user_id = ${ownerId}
      AND status = 'ready'
      AND acknowledged_at IS NULL
      AND expires_at > now()
    ORDER BY finished_at DESC
    LIMIT 20
  `;
  return rows.map(row => ({
    id: row.id, label: row.root_reference,
    finished_at: row.finished_at instanceof Date ? row.finished_at.toISOString() : String(row.finished_at),
  }));
}

export async function acknowledgeOwnerExportJobs(ownerId: number) {
  const sql = getLocalPostgres();
  await sql`
    UPDATE css_admin.export_job
    SET acknowledged_at = now()
    WHERE owner_admin_user_id = ${ownerId}
      AND status = 'ready'
      AND acknowledged_at IS NULL
  `;
}

export async function cancelQueuedOwnerExportJob(ownerId: number, id: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid export job.");
  }
  const sql = getLocalPostgres();
  const rows = await sql`
    UPDATE css_admin.export_job
    SET status = 'cancelled', finished_at = now()
    WHERE owner_admin_user_id = ${ownerId} AND id = ${id}
      AND status = 'queued'
    RETURNING id
  `;
  if (!rows.length) throw new Error("This export is no longer waiting in the queue.");
}

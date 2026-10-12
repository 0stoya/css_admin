import { open, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  BULK_EXPORTS, bulkCsvHeader, bulkCsvRows, csvRow,
  prepareBulkCompanies, rolePermissionColumns, assertMatchingRoleColumns,
  type BulkExportKind, type RolePermissionColumn, type BulkCsvData,
} from "../lib/bulk-export-csv";
import type { CompanySummary } from "../lib/graphql/companies";
import type { CompanyManagement } from "../lib/graphql/company-management";
import type { CompanyControlsBundle } from "../lib/graphql/company-controls";

type BulkJob = {
  id: string;
  run_token: string;
  export_kind: BulkExportKind;
  root_company_id: number;
  company_ids: number[];
  total_companies: number;
};

export type BulkExportDependencies = {
  exportDir: string;
  stopped: () => boolean;
  getServiceCompanies: () => Promise<CompanySummary[]>;
  getManagement: (companyId: number) => Promise<CompanyManagement>;
  getControls: (companyId: number) => Promise<CompanyControlsBundle>;
  getDescription: (companyId: number) => Promise<string>;
  heartbeat: (completed: number) => Promise<void>;
  finish: (name: string, bytes: number) => Promise<boolean>;
};

// This is a private artifact size limit, NOT a whole-file memory allocation.
const MAX_CSV_BYTES = 256 * 1024 * 1024;
const BUFFER_CHARS = 64 * 1024;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function runBulkCsvExport(job: BulkJob, deps: BulkExportDependencies) {
  if (!UUID.test(job.id) || !UUID.test(job.run_token)) throw new Error("Invalid export job lease.");
  const approved = Array.from(job.company_ids, Number);
  if (approved.length !== job.total_companies || approved.length < 1 ||
      approved.length > 10000 || !approved.includes(job.root_company_id) ||
      new Set(approved).size !== approved.length ||
      approved.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) {
    throw new Error("The stored bulk export scope is invalid.");
  }

  // The service identity can see MORE companies than the requesting Staff Admin.
  // Never expand beyond the IDs captured under the initiating user's session.
  const all = await deps.getServiceCompanies();
  const visible = new Map(all.map(company => [company.company_id, company] as const));
  if (approved.some(id => !visible.has(id))) {
    throw new Error("An approved company is no longer visible to the export worker.");
  }
  const members = prepareBulkCompanies(job.export_kind, approved.map(id => visible.get(id)!));
  if (members.length !== approved.length) {
    throw new Error("An approved company no longer has a valid reference.");
  }
  const byId = new Map(members.map(company => [company.company_id, company] as const));
  const name = job.id + "-" + job.run_token + ".csv";
  const path = join(deps.exportDir, name);
  const handle = await open(path, "wx", 0o600);
  let closed = false;
  let bytes = 0;
  let position = 0;
  let pending = "";
  let columns: RolePermissionColumn[] | null = null;
  let headerWritten = false;

  async function flush() {
    if (!pending) return;
    const buffer = Buffer.from(pending, "utf8");
    pending = "";
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesWritten } = await handle.write(buffer, offset, buffer.byteLength - offset, position);
      if (bytesWritten <= 0) throw new Error("Could not write export artifact.");
      position += bytesWritten;
      offset += bytesWritten;
    }
  }

  async function append(text: string) {
    bytes += Buffer.byteLength(text, "utf8");
    if (bytes > MAX_CSV_BYTES) throw new Error("Bulk CSV exceeds the 256 MB export limit.");
    pending += text;
    if (pending.length >= BUFFER_CHARS) await flush();
  }

  try {
    for (let index = 0; index < members.length; index++) {
      if (deps.stopped()) throw new Error("Worker restarted before completing export.");
      const company = members[index];
      const data: BulkCsvData = {};
      if (job.export_kind === "bulk_users" || job.export_kind === "bulk_roles") {
        const management = await deps.getManagement(company.company_id);
        if (management.company_id !== company.company_id) {
          throw new Error("Worker received management data for the wrong company.");
        }
        data.management = management;
        if (job.export_kind === "bulk_roles") {
          if (columns === null) columns = rolePermissionColumns(management.resources);
          else assertMatchingRoleColumns(columns, management.resources);
          data.columns = columns;
        }
      } else if (job.export_kind === "bulk_role_products" ||
                 job.export_kind === "bulk_company_products" ||
                 job.export_kind === "bulk_purchase_controls") {
        const controls = await deps.getControls(company.company_id);
        if (controls.company_id !== company.company_id) {
          throw new Error("Worker received controls data for the wrong company.");
        }
        data.controls = controls;
        if (job.export_kind === "bulk_purchase_controls" && !controls.purchase_controls) {
          throw new Error("Worker controls response omitted purchase templates.");
        }
      } else if (job.export_kind === "bulk_company_descriptions") {
        data.description = await deps.getDescription(company.company_id);
      } else if (job.export_kind === "bulk_company_structure") {
        const parent = company.parent_company_id === null ? null : byId.get(company.parent_company_id);
        if (company.parent_company_id !== null && !parent?.reference) {
          throw new Error("A company parent is outside the approved export scope.");
        }
        data.parentReference = parent?.reference?.trim() ?? "";
      }

      if (!headerWritten) {
        await append("\uFEFF" + csvRow(bulkCsvHeader(job.export_kind, columns ?? [])));
        headerWritten = true;
      }
      for (const row of bulkCsvRows(job.export_kind, company, data)) {
        await append("\r\n" + csvRow(row));
      }
      // Update lease and progress after each bounded company read/write. No
      // accumulation of all-company GraphQL data or CSV rows in memory.
      await flush();
      await deps.heartbeat(index + 1);
    }

    if (BULK_EXPORTS[job.export_kind].trailingNewline) await append("\r\n");
    await flush();
    await handle.sync();
    await handle.close();
    closed = true;

    if (!await deps.finish(name, bytes)) throw new Error("The worker lost its export-job lease.");
    console.log("[export-worker] ready job=" + job.id + " kind=" + job.export_kind +
      " companies=" + members.length + " bytes=" + bytes);
  } catch (error) {
    if (!closed) await handle.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
}

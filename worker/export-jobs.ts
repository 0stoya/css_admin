import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { buildCompanyStructure, findCompanyStructureContext, flattenCompanyStructure } from "../lib/company-structure";
import { makeCompanyStructureSnapshotSheets, type StructureSnapshotCompany } from "../lib/company-structure-snapshot";
import { createSnapshotXlsx } from "../lib/simple-xlsx";
import type { CompanySummary } from "../lib/graphql/companies";
import type { CompanyManagement } from "../lib/graphql/company-management";
import type { CompanyControlsBundle } from "../lib/graphql/company-controls";
import { isBulkExportKind, type BulkExportKind } from "../lib/bulk-export-csv";
import { runBulkCsvExport } from "./bulk-export-csv";

// Dedicated process; never uses or stores an interactive Magento Admin cookie.
// A restricted Magento *admin user* is required: integration tokens do not
// satisfy Fluid's USER_TYPE_ADMIN scope.
const envFile = process.env.CSS_ADMIN_JOB_ENV_FILE || "/etc/css-admin/export-worker.env";
if (existsSync(envFile)) {
  if ((statSync(envFile).mode & 0o077) !== 0) {
    throw new Error("The worker environment file must not be readable by group or others.");
  }
  process.loadEnvFile(envFile);
}

function required(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error("Missing worker configuration: " + key);
  return value;
}
const dbUrl = required("CSS_ADMIN_DATABASE_URL");
const magentoBase = required("MAGENTO_BASE_URL").replace(/\/+$/, "");
function secureMagentoEndpoint(value: string, label: string) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(label + " must be a valid HTTPS URL."); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(label + " must be an HTTPS URL without embedded credentials.");
  }
  return url.toString();
}
const graphqlUrl = secureMagentoEndpoint(
  process.env.MAGENTO_GRAPHQL_URL?.trim() || magentoBase + "/graphql",
  "Worker Magento GraphQL endpoint",
);
const adminTokenUrl = secureMagentoEndpoint(
  process.env.MAGENTO_ADMIN_TOKEN_URL?.trim() ||
    magentoBase + "/rest/V1/integration/admin/token",
  "Worker Magento admin-token endpoint",
);
const storeCode = required("MAGENTO_STORE_CODE");
const serviceUsername = required("CSS_ADMIN_JOB_MAGENTO_USERNAME");
const servicePassword = required("CSS_ADMIN_JOB_MAGENTO_PASSWORD");
const exportDir = required("CSS_ADMIN_EXPORT_DIR");
if (!exportDir.startsWith("/") || exportDir === "/" || exportDir.includes("..")) {
  throw new Error("CSS_ADMIN_EXPORT_DIR must be a dedicated absolute path.");
}
const sql = postgres(dbUrl, { max: 3, prepare: false, connect_timeout: 10, idle_timeout: 20 });
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const POLL_MS = 5000;
const PREFLIGHT_MODE = process.argv.includes("--preflight");
const preflightRefArg = process.argv.find(arg => arg.startsWith("--check-ref="));
const bulkPreflight = process.argv.includes("--check-bulk");
const preflightReference = preflightRefArg?.slice("--check-ref=".length).trim() || null;
const expectedAdminIdRaw = process.env.CSS_ADMIN_JOB_EXPECTED_ADMIN_ID?.trim();
const expectedAdminId = expectedAdminIdRaw ? Number(expectedAdminIdRaw) : null;

if ((preflightRefArg && !PREFLIGHT_MODE) ||
    (bulkPreflight && (!PREFLIGHT_MODE || !preflightRefArg)) ||
    (preflightReference && !/^[a-zA-Z0-9_\/-]{1,50}$/.test(preflightReference)) ||
    process.argv.slice(2).some(arg => arg !== "--preflight" && arg !== "--check-bulk" && !arg.startsWith("--check-ref="))) {
  throw new Error("Expected --preflight [--check-ref=COMPANY_REF] [--check-bulk] or no arguments.");
}
if (expectedAdminId !== null &&
    (!Number.isSafeInteger(expectedAdminId) || expectedAdminId < 1)) {
  throw new Error("CSS_ADMIN_JOB_EXPECTED_ADMIN_ID must be a positive Magento Admin user ID.");
}
if (!PREFLIGHT_MODE && expectedAdminId === null) {
  throw new Error("Pin CSS_ADMIN_JOB_EXPECTED_ADMIN_ID before starting the live worker.");
}

let stopped = false;
process.once("SIGTERM", () => { stopped = true; });
process.once("SIGINT", () => { stopped = true; });
let token: string | null = null;
let tokenRequest: Promise<string> | null = null;

type WorkerJob = {
  id: string;
  run_token: string;
  attempts: number;
  root_company_id: number;
  root_reference: string;
  export_kind: "company_structure_products" | BulkExportKind;
  company_ids: number[];
  total_companies: number;
};

const LIST_QUERY = `query AdminExportJobCompanyList($page: Int!) {
  css_admin_companies(currentPage: $page, pageSize: 100) {
    items { company_id reference status name sales_representative_id parent_company_id }
    page_info { total_pages }
  }
}`;

const MANAGEMENT_QUERY = `query AdminExportJobCompanyManagement($companyId: Int!) {
  css_admin_company_management(company_id: $companyId) {
    company_id
    users {
      user_id customer_id firstname lastname email is_company_admin manager_user_id
      approval_type approval_threshold can_checkout can_approve_credit_orders
      can_auto_approve_credit_order
      roles { role_id name manageable }
    }
    roles {
      role_id name sort_order allowed_resources user_count purchase_employee_count manageable
    }
    resources { resource_id title parent_resource_id depth assignable }
  }
}`;

const CONTROLS_QUERY = `query AdminExportJobCompanyControls($companyId: Int!) {
  css_admin_company_controls_export(company_id: $companyId) {
    format schema_version company_id
    company_catalog {
      allow_public_catalog category_restriction allowed_category_ids
      product_restriction allowed_products { sku }
    }
    role_controls {
      role_name sort_order allowed_resources selected_category_ids
      preselect_all_products allowed_product_skus
    }
  }
}`;

const BULK_CONTROLS_QUERY = `query AdminExportJobBulkControls($companyId: Int!) {
  css_admin_company_controls_export(company_id: $companyId) {
    format schema_version company_id
    company_catalog {
      allow_public_catalog category_restriction allowed_category_ids
      product_restriction allowed_products { sku }
    }
    role_controls {
      role_name sort_order allowed_resources selected_category_ids
      preselect_all_products allowed_product_skus
    }
    purchase_controls {
      templates {
        name
        rules { sku quantity_limit duration_days start_date }
        assigned_role_names
      }
    }
  }
}`;

const PRESENTATION_QUERY = `query AdminExportJobCompanyPresentation($companyId: Int!) {
  css_admin_company_presentation(company_id: $companyId) {
    company_id company_description
  }
}`;

// Defense against future accidental mutation calls in this service. The
// existing Fluid ACLs still make its credential privileged if it is stolen.
const allowedOperations = new Set([
  "ExportWorkerIdentity",
  "AdminExportJobCompanyList",
  "AdminExportJobCompanyManagement",
  "AdminExportJobCompanyControls",
  "AdminExportJobBulkControls",
  "AdminExportJobCompanyPresentation",
]);
function assertReadOnlyWorkerOperation(query: string) {
  const operation = /^\s*query\s+([A-Za-z][A-Za-z0-9_]*)\b/.exec(query)?.[1];
  if (!operation || !allowedOperations.has(operation) ||
      /\b(?:mutation|subscription)\b/i.test(query)) {
    throw new Error("Export worker is limited to its approved read-only GraphQL operations.");
  }
}

function timeout() { return AbortSignal.timeout(20000); }

async function obtainAdminToken() {
  const response = await fetch(adminTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: serviceUsername, password: servicePassword }),
    signal: timeout(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Worker Magento admin authentication rejected (" + response.status + ").");
  const value: unknown = await response.json();
  if (typeof value !== "string" || !value) throw new Error("Worker Magento authentication returned no token.");
  return value;
}

async function adminToken(force = false) {
  if (!force && token) return token;
  if (!tokenRequest) tokenRequest = obtainAdminToken().then(value => {
    token = value;
    return value;
  }).finally(() => { tokenRequest = null; });
  return tokenRequest;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  assertReadOnlyWorkerOperation(query);
  for (let attempt = 0; attempt < 2; attempt++) {
    const currentToken = await adminToken(attempt > 0);
    let response: Response;
    try {
      response = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + currentToken, Store: storeCode,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: timeout(), cache: "no-store",
      });
    } catch {
      throw new Error("Worker Magento GraphQL network or timeout failure.");
    }
    if (response.status === 401 && attempt === 0) { token = null; continue; }
    if (!response.ok) throw new Error("Worker Magento GraphQL returned HTTP " + response.status + ".");
    const body = await response.json() as {
      data?: T; errors?: Array<{ message?: string; extensions?: { category?: string } }>;
    };
    if (body.errors?.length) {
      const auth = body.errors.some(item => item.extensions?.category === "graphql-authorization");
      if (auth && attempt === 0) { token = null; continue; }
      throw new Error("Worker Magento GraphQL denied the requested company data.");
    }
    if (!body.data) throw new Error("Worker Magento GraphQL returned an empty response.");
    return body.data;
  }
  throw new Error("Worker Magento admin credential is invalid or expired.");
}

async function getServiceCompanies(): Promise<CompanySummary[]> {
  const result: CompanySummary[] = [];
  for (let page = 1; page <= 500; page++) {
    const data = await gql<{
      css_admin_companies: {
        items: CompanySummary[];
        page_info: { total_pages: number };
      };
    }>(LIST_QUERY, { page });
    result.push(...data.css_admin_companies.items);
    if (page >= data.css_admin_companies.page_info.total_pages) return result;
  }
  throw new Error("Worker company listing exceeded 500 pages; refusing incomplete scope.");
}

async function collectCompany(company: CompanySummary): Promise<StructureSnapshotCompany> {
  const [management, data] = await Promise.all([
    gql<{ css_admin_company_management: CompanyManagement }>(MANAGEMENT_QUERY, { companyId: company.company_id }),
    gql<{
      css_admin_company_controls_export: Omit<CompanyControlsBundle, "company_catalog"> & {
        company_catalog: Omit<CompanyControlsBundle["company_catalog"], "allowed_product_skus"> & {
          allowed_products: Array<{ sku: string }>;
        };
      };
    }>(CONTROLS_QUERY, { companyId: company.company_id }),
  ]);
  const bundle = data.css_admin_company_controls_export;
  const controls: CompanyControlsBundle = {
    ...bundle,
    company_catalog: {
      ...bundle.company_catalog,
      allowed_product_skus: bundle.company_catalog.allowed_products.map(item => item.sku),
    },
  };
  if (management.css_admin_company_management.company_id !== company.company_id ||
      controls.company_id !== company.company_id) {
    throw new Error("Worker received data for an unexpected company.");
  }
  return { company, management: management.css_admin_company_management, controls };
}

async function getBulkManagement(companyId: number): Promise<CompanyManagement> {
  const data = await gql<{ css_admin_company_management: CompanyManagement }>(
    MANAGEMENT_QUERY, { companyId },
  );
  return data.css_admin_company_management;
}

async function getBulkControls(companyId: number): Promise<CompanyControlsBundle> {
  const data = await gql<{
    css_admin_company_controls_export: Omit<CompanyControlsBundle, "company_catalog"> & {
      company_catalog: Omit<CompanyControlsBundle["company_catalog"], "allowed_product_skus"> & {
        allowed_products: Array<{ sku: string }>;
      };
    };
  }>(BULK_CONTROLS_QUERY, { companyId });
  const bundle = data.css_admin_company_controls_export;
  return {
    ...bundle,
    company_catalog: {
      ...bundle.company_catalog,
      allowed_product_skus: bundle.company_catalog.allowed_products.map(item => item.sku),
    },
  };
}

async function getBulkDescription(companyId: number): Promise<string> {
  const data = await gql<{
    css_admin_company_presentation: { company_id: number; company_description: string | null };
  }>(PRESENTATION_QUERY, { companyId });
  const result = data.css_admin_company_presentation;
  if (!result || result.company_id !== companyId) {
    throw new Error("Worker received a company description for the wrong company.");
  }
  return result.company_description ?? "";
}

async function createExportDir() {
  await mkdir(exportDir, { mode: 0o700, recursive: true });
  if ((statSync(exportDir).mode & 0o077) !== 0) {
    throw new Error("Worker export directory is not private (requires 0700).");
  }
}

async function recoverExpiredLeases() {
  await sql`
    UPDATE css_admin.export_job
    SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
        run_token = NULL, lease_expires_at = NULL,
        run_after = now() + interval '20 seconds',
        error_message = 'Worker restarted before completing export.',
        finished_at = CASE WHEN attempts >= 3 THEN now() ELSE finished_at END
    WHERE status = 'running' AND lease_expires_at < now()
  `;
}

async function claim(): Promise<WorkerJob | null> {
  const lease = randomUUID();
  const rows = await sql<WorkerJob[]>`
    WITH picked AS (
      SELECT id FROM css_admin.export_job
      WHERE status = 'queued' AND run_after <= now()
      ORDER BY run_after, created_at
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE css_admin.export_job AS job
    SET status = 'running', run_token = ${lease},
        attempts = job.attempts + 1, completed_companies = 0,
        lease_expires_at = now() + interval '3 minutes',
        started_at = now(), error_message = NULL
    FROM picked WHERE job.id = picked.id
    RETURNING job.id, job.run_token, job.attempts,
      job.root_company_id, job.root_reference, job.export_kind, job.company_ids, job.total_companies
  `;
  return rows[0] ?? null;
}

async function heartbeat(job: WorkerJob, completed: number) {
  const rows = await sql`
    UPDATE css_admin.export_job
    SET completed_companies = ${completed}, lease_expires_at = now() + interval '3 minutes'
    WHERE id = ${job.id} AND run_token = ${job.run_token} AND status = 'running'
    RETURNING id
  `;
  if (!rows.length) throw new Error("The worker lost its export-job lease.");
}

async function finish(job: WorkerJob, name: string, bytes: number) {
  const rows = await sql`
    UPDATE css_admin.export_job SET
      status = 'ready', completed_companies = total_companies,
      artifact_name = ${name}, artifact_bytes = ${bytes},
      run_token = NULL, lease_expires_at = NULL,
      finished_at = now(), expires_at = now() + interval '7 days'
    WHERE id = ${job.id} AND run_token = ${job.run_token}
      AND status = 'running'
    RETURNING id
  `;
  return rows.length === 1;
}

function isRetryable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /network|timeout|HTTP 5\d\d|Worker restarted|fetch failed/i.test(message);
}

async function fail(job: WorkerJob, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected worker export failure.";
  const retry = job.attempts < 3 && isRetryable(error);
  await sql`
    UPDATE css_admin.export_job SET
      status = ${retry ? "queued" : "failed"},
      run_after = now() + (interval '45 seconds' * ${job.attempts}),
      error_message = ${message.slice(0, 400)},
      finished_at = CASE WHEN ${retry} THEN NULL ELSE now() END,
      run_token = NULL, lease_expires_at = NULL
    WHERE id = ${job.id} AND run_token = ${job.run_token}
      AND status = 'running'
  `;
}

async function run(job: WorkerJob) {
  if (!UUID.test(job.id) || !UUID.test(job.run_token)) throw new Error("Invalid worker lease.");
  if (isBulkExportKind(job.export_kind)) {
    return runBulkCsvExport({ ...job, export_kind: job.export_kind }, {
      exportDir,
      stopped: () => stopped,
      getServiceCompanies,
      getManagement: getBulkManagement,
      getControls: getBulkControls,
      getDescription: getBulkDescription,
      heartbeat: completed => heartbeat(job, completed),
      finish: (name, bytes) => finish(job, name, bytes),
    });
  }
  if (job.export_kind !== "company_structure_products") {
    throw new Error("Unrecognised export kind; refusing to create an artifact.");
  }
  const approved = Array.from(job.company_ids, Number);
  if (approved.length !== job.total_companies || approved.length < 2 || approved.length > 80 ||
      new Set(approved).size !== approved.length || !approved.includes(job.root_company_id)) {
    throw new Error("The stored job company scope is invalid.");
  }
  // The worker may see MORE companies than the initiating Admin. Never expand
  // the captured and validated company_ids from that Admin's enqueue request.
  const all = await getServiceCompanies();
  const context = findCompanyStructureContext(buildCompanyStructure(all), job.root_company_id);
  if (!context || context.root.company.company_id !== job.root_company_id ||
      context.root.company.parent_company_id !== null) {
    throw new Error("Worker cannot verify the authorised group head.");
  }
  const visible = new Map(flattenCompanyStructure(context.root).map(item =>
    [item.company.company_id, item.company] as const));
  if (approved.some(id => !visible.has(id))) {
    throw new Error("The approved company structure changed or is not visible to the worker.");
  }
  const members = approved.map(id => visible.get(id)!);
  const start = new Date().toISOString();
  const records: StructureSnapshotCompany[] = [];
  for (let i = 0; i < members.length; i += 2) {
    if (stopped) throw new Error("Worker restarted before completing export.");
    const collected = await Promise.all(members.slice(i, i + 2).map(collectCompany));
    records.push(...collected);
    await heartbeat(job, records.length);
  }
  const end = new Date().toISOString();
  const bytes = createSnapshotXlsx(
    makeCompanyStructureSnapshotSheets(visible.get(job.root_company_id)!, records, start, end),
  );
  if (bytes.byteLength > 75 * 1024 * 1024) throw new Error("Export exceeds the 75 MB file limit.");
  const name = job.id + "-" + job.run_token + ".xlsx";
  const file = join(exportDir, name);
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  if (!await finish(job, name, bytes.byteLength)) {
    await unlink(file).catch(() => {});
    throw new Error("The worker lost its export-job lease.");
  }
  console.log("[export-worker] ready job=" + job.id + " companies=" + records.length +
    " bytes=" + bytes.byteLength);
}

async function expireFiles() {
  const expired = await sql<{ id: string; artifact_name: string | null }[]>`
    WITH targets AS (
      SELECT id, artifact_name FROM css_admin.export_job
      WHERE status = 'ready' AND expires_at < now()
      FOR UPDATE SKIP LOCKED
    )
    UPDATE css_admin.export_job AS job
    SET status = 'expired', artifact_name = NULL, artifact_bytes = NULL
    FROM targets WHERE job.id = targets.id
    RETURNING job.id, targets.artifact_name
  `;
  for (const row of expired) {
    const name = row.artifact_name;
    if (name && /^[0-9a-f-]{36}-[0-9a-f-]{36}\.(?:xlsx|csv)$/i.test(name)) {
      await unlink(join(exportDir, name)).catch(() => {});
    }
  }
}

async function runPreflight() {
  const companies = await getServiceCompanies();
  if (!preflightReference) {
    console.log("[export-worker] PREFLIGHT OK; service identity and company-list ACL verified."
      + " Pass --check-ref=GROUP_REFERENCE to test management and product restrictions.");
    return;
  }
  const target = companies.find(company =>
    company.reference?.trim().toLowerCase() === preflightReference.toLowerCase());
  if (!target) throw new Error("Preflight company reference is not visible to the worker.");
  const context = findCompanyStructureContext(buildCompanyStructure(companies), target.company_id);
  if (!context || context.root.company.parent_company_id !== null ||
      context.root.descendant_count === 0) {
    throw new Error("Preflight cannot verify a complete, visible company structure.");
  }
  const members = flattenCompanyStructure(context.root).map(entry => entry.company);
  const sample = members.slice(0, 2);
  await Promise.all(sample.map(collectCompany));
  if (bulkPreflight) {
    // The previous XLSX preflight only exercises management and role/catalogue.
    // Bulk CSVs additionally read purchase templates and portal descriptions.
    await Promise.all(sample.map(async company => {
      const [controls] = await Promise.all([
        getBulkControls(company.company_id),
        getBulkDescription(company.company_id),
      ]);
      if (!controls.purchase_controls) {
        throw new Error("Preflight company-controls response lacks purchase templates.");
      }
    }));
  }
  console.log("[export-worker] PREFLIGHT OK; group=" +
    preflightReference + " visible_members=" + members.length +
    " company_reads_checked=" + sample.length +
    (bulkPreflight ? " (management, controls, purchase templates, descriptions)." : " (management and controls).") +
    " No queue jobs claimed.");
}

async function main() {
  // Fail startup visibly rather than appearing healthy while repeatedly
  // polling a missing database migration or invalid service identity.
  await createExportDir();
  await sql`SELECT id FROM css_admin.export_job LIMIT 0`;
  const [migration] = await sql<{ ready: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'css_admin.export_job'::regclass
        AND conname = 'export_job_export_kind_check'
        AND pg_get_constraintdef(oid) LIKE '%bulk_purchase_controls%'
    ) AS ready
  `;
  if (!migration?.ready) throw new Error(
    "Export jobs migration 003 is required before starting the new worker.",
  );
  const identity = await gql<{
    css_admin_current_user: { user_id: number; active: boolean };
  }>(`query ExportWorkerIdentity { css_admin_current_user { user_id active } }`, {});
  if (!identity.css_admin_current_user?.active ||
      !Number.isSafeInteger(identity.css_admin_current_user.user_id) ||
      identity.css_admin_current_user.user_id <= 0) {
    throw new Error("The export worker service account is not an active Magento Admin.");
  }
  if (expectedAdminId !== null &&
      identity.css_admin_current_user.user_id !== expectedAdminId) {
    throw new Error("Worker Magento identity differs from CSS_ADMIN_JOB_EXPECTED_ADMIN_ID.");
  }
  if (PREFLIGHT_MODE) {
    console.log("[export-worker] PREFLIGHT identity user_id=" +
      identity.css_admin_current_user.user_id);
    await runPreflight();
    await sql.end({ timeout: 5 });
    return;
  }
  console.log("[export-worker] started; queue=postgres, files=private, concurrency=1");
  let iteration = 0;
  while (!stopped) {
    try {
      await recoverExpiredLeases();
      if (iteration++ % 120 === 0) await expireFiles();
      const job = await claim();
      if (job) {
        try { await run(job); }
        catch (error) {
          // Deliberately avoid dumping tokens, GraphQL payloads or user records.
          console.error("[export-worker] job=" + job.id + " failed:", error instanceof Error ? error.message : "unknown error");
          await fail(job, error);
        }
        continue;
      }
    } catch (error) {
      console.error("[export-worker] queue unavailable:", error instanceof Error ? error.message : "unknown error");
    }
    await new Promise<void>(resolve => setTimeout(resolve, POLL_MS));
  }
  await sql.end({ timeout: 5 });
}

main().catch(error => {
  console.error("[export-worker] fatal:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});

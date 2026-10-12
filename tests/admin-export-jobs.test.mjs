import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const structure = load(root, "lib/company-structure.ts");
const auth = load(root, "lib/admin-job-auth.ts", {
  "@/lib/graphql/client": {
    graphqlRequest: async () => ({
      css_admin_current_user: { user_id: 18, username: "staff-user", active: true },
    }),
  },
  "@/lib/graphql/companies": { getAllCompanies: async () => [] },
  "@/lib/company-structure": structure,
});

const company = (id, parent = null, ref = "GROUP" + id) => ({
  company_id: id, parent_company_id: parent, reference: ref,
  name: "Test " + id, status: true, sales_representative_id: 18,
});

test("Staff user identity comes from the authenticated Fluid admin, not a cookie fingerprint", async () => {
  const actor = await auth.currentStaffJobIdentity();
  assert.equal(actor.user_id, 18);
  assert.equal(actor.active, true);
  const src = source("lib/admin-job-auth.ts");
  assert.match(src, /css_admin_current_user/);
  assert.doesNotMatch(src, /hash\(|fingerprint|customer_token|process\.env\.CSS_ADMIN_JOB_MAGENTO_PASSWORD/);
});

test("queue only targets the structure visible to the current Staff Admin", () => {
  const companies = [company(10), company(11, 10), company(12, 10),
    company(50), company(51, 50), company(90)];
  for (const target of [10, 11, 12]) {
    const scope = auth.allowedStructureCompanies(companies, target);
    assert.equal(scope.root.company_id, 10);
    assert.deepEqual(Array.from(scope.companies, item => item.company_id), [10, 11, 12]);
  }
  assert.throws(() => auth.allowedStructureCompanies(companies, 90), /No complete/);
  assert.throws(() => auth.allowedStructureCompanies([company(11, 10)], 11), /No complete/);
});

test("download must re-evaluate current visibility and require every originally approved member", () => {
  const companies = [company(10), company(11, 10), company(12, 10), company(50), company(51, 50)];
  assert.equal(auth.canDownloadScopedJob(companies, 10, [10, 11, 12]), true);
  assert.equal(auth.canDownloadScopedJob(companies, 10, [10, 11, 50]), false);
  assert.equal(auth.canDownloadScopedJob(companies, 10, [10, 11, 11]), false);
  assert.equal(auth.canDownloadScopedJob(companies.filter(c => c.company_id !== 12), 10, [10, 11, 12]), false);
  assert.equal(auth.canDownloadScopedJob(companies, 90, [90, 91]), false);
});

test("worker claims jobs with Postgres SKIP LOCKED, lease tokens, retries and progress", () => {
  const w = source("worker/export-jobs.ts");
  for (const required of [
    "FOR UPDATE SKIP LOCKED", "run_token", "lease_expires_at",
    "completed_companies", "recoverExpiredLeases", "heartbeat(",
    "status = 'ready'", "await fail(job, error)", "expireFiles()",
    "approved.map(id => visible.get(id)!)", "at most",
  ].filter(s => s !== "at most")) assert.ok(w.includes(required), "Missing " + required);
  assert.match(w, /CSS_ADMIN_JOB_MAGENTO_USERNAME/);
  assert.match(w, /CSS_ADMIN_JOB_MAGENTO_PASSWORD/);
  assert.match(w, /USER_TYPE_ADMIN/);
  assert.match(w, /mode: 0o600/);
  assert.match(w, /mode: 0o700/);
  assert.match(w, /if \(!await finish\(job, name, bytes\.byteLength\)\)/);
  assert.match(w, /targets\.artifact_name/);
  assert.doesNotMatch(w, /getAdminToken\(|css_admin_token|css_company_token/);
});

test("queue creation is owned, rate-limited and uses a separate feature gate", () => {
  const db = source("lib/admin-export-jobs.ts");
  const actions = source("app/(admin)/jobs/actions.ts");
  assert.match(db, /CSS_ADMIN_EXPORT_JOBS_ENABLED === "1"/);
  assert.match(db, /pg_advisory_xact_lock/);
  assert.match(db, /owner_admin_user_id =/);
  assert.match(db, /count\(\*\)::integer/);
  assert.match(db, /status IN \('queued', 'running'\)/);
  // Explicit server-side array conversion avoids Postgres.js array OID encoding.
  // Live read-only integration: scripts/verify-export-job-array.mjs.
  assert.ok(db.includes('companyIdsCsv = companyIds.join(",")'));
  assert.ok(db.includes("string_to_array(${companyIdsCsv}, ',')::integer[]"));
  assert.match(db, /id > 2147483647/);
  assert.doesNotMatch(db, /sql\.array\(companyIds/);
  const diagnostic = source("scripts/verify-export-job-array.mjs");
  assert.match(diagnostic, /string_to_array/);
  assert.match(diagnostic, /EXPORT ARRAY CHECK PASS/);
  assert.doesNotMatch(diagnostic, /INSERT INTO|UPDATE css_admin|DELETE FROM css_admin/);
  assert.match(actions, /currentStaffJobIdentity\(\)/);
  assert.match(actions, /allowedStructureCompanies\(visible, id\)/);
  assert.match(actions, /enqueueStructureExport\(actor\.user_id, id, root, companies\)/);
  assert.doesNotMatch(actions, /cookie.*token|store.*token/i);
});

test("completed exports are private, no-store and re-authorised before any filesystem IO", () => {
  const download = source("app/api/admin/jobs/[id]/download/route.ts");
  const ready = source("app/api/admin/jobs/notifications/route.ts");
  assert.match(download, /getOwnerExportJob\(actor\.user_id, id\)/);
  assert.match(download, /ensureJobDownloadScope\(job\.root_company_id, job\.company_ids, job\.export_kind\)/);
  assert.ok(download.indexOf("ensureJobDownloadScope") < download.indexOf("lstat(path)"));
  assert.match(download, /isSymbolicLink/);
  assert.match(download, /private, no-store/);
  assert.match(download, /job\.status !== "ready"/);
  assert.match(ready, /ownerReadyNotifications\(actor\.user_id\)/);
  assert.match(ready, /private, no-store/);
});

test("PostgreSQL computes job download readiness without impure render-time clock calls", () => {
  const db = source("lib/admin-export-jobs.ts");
  const page = source("app/(admin)/jobs/page.tsx");
  assert.match(db, /downloadable: boolean/);
  assert.equal(
    db.split("status = 'ready' AND expires_at > now()").length - 1,
    2,
    "Both list and owner lookup must use the database clock",
  );
  assert.match(page, /const ready = job\.downloadable/);
  assert.match(page, /job\.downloadable && !job\.acknowledged_at/);
  assert.doesNotMatch(page, /Date\.now\(\)/);
});

test("the header, overview and Import/Export expose the same durable queue", () => {
  const header = source("components/app-header.tsx");
  const admin = source("app/(admin)/layout.tsx");
  const overview = source("app/(admin)/companies/[id]/page.tsx");
  const imports = source("app/(admin)/companies/[id]/import-export/page.tsx");
  const page = source("app/(admin)/jobs/page.tsx");
  assert.match(header, /AdminExportJobBell/);
  assert.match(admin, /href: "\/jobs"/);
  assert.match(page, /AdminJobsAutoRefresh/);
  assert.match(page, /Download Excel/);
  for (const s of [overview, imports]) {
    assert.match(s, /queueStructureSnapshotAction/);
    assert.match(s, /hasExportJobStore\(\)/);
    assert.match(s, /exports\/structure-snapshot/);
  }
});

test("ESLint excludes the generated worker directory without disabling source lint rules", () => {
  const eslint = source("eslint.config.mjs");
  assert.match(eslint, /globalIgnores\(\[/);
  assert.match(eslint, /"\.worker-dist\/\*\*"/);
  assert.match(eslint, /\.\.\.nextVitals/);
  assert.match(eslint, /\.\.\.nextTs/);
});

test("worker preflight uses existing Fluid reads without queue claims or mutations", () => {
  const worker = source("worker/export-jobs.ts");
  const doc = source("docs/ADMIN_BACKGROUND_EXPORT_JOBS.md");
  assert.match(worker, /--preflight/);
  assert.match(worker, /--check-ref=/);
  assert.match(worker, /runPreflight\(\)/);
  assert.match(worker, /PREFLIGHT_MODE/);
  assert.match(worker, /CSS_ADMIN_JOB_EXPECTED_ADMIN_ID/);
  assert.match(worker, /assertReadOnlyWorkerOperation\(query\)/);
  assert.match(worker, /secureMagentoEndpoint/);
  assert.match(worker, /url\.protocol !== "https:"/);
  assert.match(worker, /AdminExportJobCompanyControls/);
  assert.match(doc, /no Fluid deployment required/i);
  assert.match(doc, /all_companies/);
  assert.match(doc, /not actually\s+read-only/);
});

test("worker startup and PostgreSQL migration remain explicitly opt-in", () => {
  const ecosystem = source("ecosystem.exports.config.cjs");
  const config = source("tsconfig.worker.json");
  const migration = source("deploy/postgres/002_admin_export_jobs.sql");
  const scripts = JSON.parse(source("package.json")).scripts;
  assert.match(ecosystem, /css-admin-export-worker/);
  assert.match(ecosystem, /\.worker-dist\/worker\/export-jobs\.js/);
  assert.match(config, /Node16/);
  assert.match(scripts.build, /build:worker/);
  assert.match(migration, /owner_admin_user_id/);
  assert.match(migration, /CHECK \(root_company_id = ANY \(company_ids\)\)/);
  assert.match(migration, /status = 'queued'/);
});

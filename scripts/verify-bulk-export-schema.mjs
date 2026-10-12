#!/usr/bin/env node
// Read-only validation of the manually applied 003 migration. No queue jobs,
 // DDL, Magento requests, or credentials are printed.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

if (!process.env.CSS_ADMIN_DATABASE_URL) {
  for (const name of [".env.production.local", ".env.local", ".env.production"]) {
    const file = resolve(process.cwd(), name);
    if (existsSync(file)) process.loadEnvFile(file);
    if (process.env.CSS_ADMIN_DATABASE_URL) break;
  }
}
if (!process.env.CSS_ADMIN_DATABASE_URL) {
  console.error("STOP: CSS_ADMIN_DATABASE_URL is missing.");
  process.exit(1);
}
const sql = postgres(process.env.CSS_ADMIN_DATABASE_URL,
  { max: 1, prepare: false, connect_timeout: 5 });
try {
  const rows = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'css_admin.export_job'::regclass
      AND conname IN (
        'export_job_export_kind_check',
        'export_job_company_ids_check',
        'export_job_total_companies_check',
        'export_job_company_count_matches',
        'export_job_root_in_scope',
        'export_job_ready_artifact'
      )
  `;
  const byName = new Map(rows.map(row => [row.conname, row.definition]));
  const kind = String(byName.get("export_job_export_kind_check") ?? "");
  const ids = String(byName.get("export_job_company_ids_check") ?? "");
  const total = String(byName.get("export_job_total_companies_check") ?? "");
  const validKinds = [
    "company_structure_products", "bulk_company_structure", "bulk_users",
    "bulk_roles", "bulk_role_products", "bulk_company_products",
    "bulk_company_descriptions", "bulk_purchase_controls",
  ];
  const valid = validKinds.every(name => kind.includes(name))
    && ids.includes("10000") && ids.includes("1")
    && total.includes("10000") && total.includes("1")
    && byName.has("export_job_company_count_matches")
    && byName.has("export_job_root_in_scope")
    && byName.has("export_job_ready_artifact");
  if (!valid) throw new Error("003 migration constraints are missing or incorrect.");
  console.log("BULK EXPORT SCHEMA PASS: eight job kinds; 1-10000 companies; existing safety checks retained; read-only.");
} catch (error) {
  console.error("BULK EXPORT SCHEMA FAILED:", error.code || "unknown");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

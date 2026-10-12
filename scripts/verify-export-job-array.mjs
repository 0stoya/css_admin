#!/usr/bin/env node
// Read-only live PostgreSQL diagnostic for the queued-export company_ids binding.
// No insert, queue claim, migration, or Magento request is performed.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

if (!process.env.CSS_ADMIN_DATABASE_URL) {
  for (const file of [".env.production.local", ".env.local", ".env.production"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) process.loadEnvFile(path);
    if (process.env.CSS_ADMIN_DATABASE_URL) break;
  }
}

if (!process.env.CSS_ADMIN_DATABASE_URL) {
  console.error("FAIL: CSS_ADMIN_DATABASE_URL is not configured in the current environment.");
  process.exit(1);
}

const sql = postgres(process.env.CSS_ADMIN_DATABASE_URL, {
  max: 1, prepare: false, connect_timeout: 5,
});

try {
  // Exactly the same parameter shape and conversion used by queue creation.
  const companyIds = [1, 2, 3];
  const companyIdsCsv = companyIds.join(",");
  const [result] = await sql`
    SELECT
      pg_typeof(string_to_array(${companyIdsCsv}, ',')::integer[])::text AS array_type,
      array_to_string(string_to_array(${companyIdsCsv}, ',')::integer[], ',') AS values_text,
      to_regclass('css_admin.export_job') IS NOT NULL AS jobs_table_exists
  `;
  if (result.array_type !== "integer[]" ||
      result.values_text !== "1,2,3" ||
      result.jobs_table_exists !== true) {
    throw new Error("The queued-export integer[] binding or jobs table is not as expected.");
  }
  console.log("EXPORT ARRAY CHECK PASS: integer[] [1,2,3]; jobs table exists; read-only.");
} catch (error) {
  console.error("EXPORT ARRAY CHECK FAILED:", error.code || "unknown");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

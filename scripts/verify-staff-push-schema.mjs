#!/usr/bin/env node
// Read-only verification for manual migration 004. Prints no secrets.
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
  console.error("STOP: CSS_ADMIN_DATABASE_URL is missing.");
  process.exit(1);
}

const sql = postgres(process.env.CSS_ADMIN_DATABASE_URL, {
  max: 1, prepare: false, connect_timeout: 5,
});
try {
  const [state] = await sql`
    SELECT
      to_regclass('css_admin.staff_push_subscription') IS NOT NULL AS subscriptions,
      to_regclass('css_admin.staff_push_delivery') IS NOT NULL AS deliveries,
      EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'css_admin.export_job'::regclass
          AND tgname = 'staff_export_ready_push'
          AND NOT tgisinternal
      ) AS trigger_ready,
      (has_table_privilege(current_user, 'css_admin.staff_push_subscription', 'SELECT')
       AND has_table_privilege(current_user, 'css_admin.staff_push_subscription', 'INSERT')
       AND has_table_privilege(current_user, 'css_admin.staff_push_subscription', 'UPDATE')
       AND has_table_privilege(current_user, 'css_admin.staff_push_subscription', 'DELETE')) AS subscription_dml,
      (has_table_privilege(current_user, 'css_admin.staff_push_delivery', 'SELECT')
       AND has_table_privilege(current_user, 'css_admin.staff_push_delivery', 'INSERT')
       AND has_table_privilege(current_user, 'css_admin.staff_push_delivery', 'UPDATE')
       AND has_table_privilege(current_user, 'css_admin.staff_push_delivery', 'DELETE')) AS delivery_dml
  `;
  if (!state.subscriptions || !state.deliveries || !state.trigger_ready ||
      !state.subscription_dml || !state.delivery_dml) {
    throw new Error("Staff push schema or runtime permissions are incomplete.");
  }
  console.log("STAFF PUSH SCHEMA PASS: tables, trigger, runtime DML; read-only.");
} catch (error) {
  console.error("STAFF PUSH SCHEMA FAILED:", error.code || "unknown");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

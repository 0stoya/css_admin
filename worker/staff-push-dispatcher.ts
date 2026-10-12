import { existsSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  assertPushDispatcherConfiguration,
  openPushSubscription, sendExportReadyPush,
} from "../lib/staff-push-crypto";

// This process has no Magento credentials, customer tokens, or VAPID secrets
// in Next's public config. Its own env file is 0600 and outside the repo.
const envFile = process.env.CSS_ADMIN_PUSH_ENV_FILE ??
  "/etc/css-admin/staff-push-worker.env";
if (!existsSync(envFile) || (statSync(envFile).mode & 0o077) !== 0) {
  throw new Error("Staff push worker env file must exist and be 0600.");
}
process.loadEnvFile(envFile);
const dbUrl = process.env.CSS_ADMIN_DATABASE_URL?.trim();
if (!dbUrl) throw new Error("Staff push worker database is not configured.");
assertPushDispatcherConfiguration();
const sql = postgres(dbUrl, {
  max: 2, prepare: false, connect_timeout: 10, idle_timeout: 20,
});

const PREFLIGHT = process.argv.includes("--preflight");
if (process.argv.slice(2).some(arg => arg !== "--preflight")) {
  throw new Error("Expected --preflight or no arguments.");
}
let stopped = false;
process.once("SIGTERM", () => { stopped = true; });
process.once("SIGINT", () => { stopped = true; });

type PushDelivery = {
  job_id: string;
  subscription_id: string;
  lease_token: string;
  attempts: number;
  sealed_subscription: string;
  owner_admin_user_id: number;
  device_id: string;
};

async function checkSchema() {
  const rows = await sql`
    SELECT
      to_regclass('css_admin.staff_push_subscription') IS NOT NULL AS subscriptions,
      to_regclass('css_admin.staff_push_delivery') IS NOT NULL AS deliveries
  `;
  if (!rows[0]?.subscriptions || !rows[0]?.deliveries) {
    throw new Error("Staff push migration 004 is incomplete.");
  }
}

async function discoverReadyExports() {
  // Run independently of the export-worker's Ready transaction. If the push
  // outbox is unavailable, export generation and Ready status still succeed.
  // updated_at is the device's latest registration time, so subscriptions
  // created or rebound AFTER completion cannot receive old job alerts.
  await sql`
    INSERT INTO css_admin.staff_push_delivery (job_id, subscription_id)
    SELECT job.id, subscription.id
    FROM css_admin.export_job job
    JOIN css_admin.staff_push_subscription subscription
      ON subscription.owner_admin_user_id = job.owner_admin_user_id
    WHERE job.status = 'ready'
      AND job.expires_at > now()
      AND job.finished_at IS NOT NULL
      AND job.finished_at >= subscription.updated_at
      AND subscription.expires_at > now()
    ON CONFLICT DO NOTHING
  `;
}

async function recoverExpiredLeases() {
  await sql`
    UPDATE css_admin.staff_push_delivery
    SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
        lease_token = NULL, lease_expires_at = NULL,
        run_after = now() + interval '30 seconds',
        last_error_code = 'interrupted'
    WHERE status = 'sending' AND lease_expires_at < now()
  `;
}

async function claim(): Promise<PushDelivery | null> {
  const token = randomUUID();
  const rows = await sql<PushDelivery[]>`
    WITH picked AS (
      SELECT delivery.job_id, delivery.subscription_id
      FROM css_admin.staff_push_delivery delivery
      JOIN css_admin.export_job job ON job.id = delivery.job_id
      JOIN css_admin.staff_push_subscription subscription
        ON subscription.id = delivery.subscription_id
      WHERE delivery.status = 'pending'
        AND delivery.run_after <= now()
        AND delivery.attempts < 5
        AND job.status = 'ready' AND job.expires_at > now()
        AND subscription.owner_admin_user_id = job.owner_admin_user_id
        AND subscription.expires_at > now()
      ORDER BY delivery.run_after, delivery.created_at
      FOR UPDATE OF delivery SKIP LOCKED
      LIMIT 1
    ), updated AS (
      UPDATE css_admin.staff_push_delivery AS delivery
      SET status = 'sending', attempts = delivery.attempts + 1,
          lease_token = ${token}, lease_expires_at = now() + interval '2 minutes'
      FROM picked
      WHERE delivery.job_id = picked.job_id
        AND delivery.subscription_id = picked.subscription_id
      RETURNING delivery.job_id, delivery.subscription_id,
        delivery.lease_token, delivery.attempts
    )
    SELECT updated.job_id, updated.subscription_id,
      updated.lease_token, updated.attempts,
      subscription.sealed_subscription,
      subscription.owner_admin_user_id, subscription.device_id
    FROM updated
    JOIN css_admin.staff_push_subscription subscription
      ON subscription.id = updated.subscription_id
    JOIN css_admin.export_job job ON job.id = updated.job_id
    WHERE subscription.owner_admin_user_id = job.owner_admin_user_id
  `;
  return rows[0] ?? null;
}

async function markSent(job: PushDelivery) {
  await sql`
    UPDATE css_admin.staff_push_delivery
    SET status = 'sent', sent_at = now(),
        lease_token = NULL, lease_expires_at = NULL, last_error_code = NULL
    WHERE job_id = ${job.job_id}::uuid
      AND subscription_id = ${job.subscription_id}::uuid
      AND lease_token = ${job.lease_token}::uuid
      AND status = 'sending'
  `;
}

async function markFailed(job: PushDelivery, code: string, retryable: boolean) {
  const retry = retryable && job.attempts < 5;
  const delay = Math.min(3600, 30 * 2 ** job.attempts);
  await sql`
    UPDATE css_admin.staff_push_delivery
    SET status = ${retry ? "pending" : "failed"},
        run_after = now() + (${delay}::integer * interval '1 second'),
        lease_token = NULL, lease_expires_at = NULL,
        last_error_code = ${code}
    WHERE job_id = ${job.job_id}::uuid
      AND subscription_id = ${job.subscription_id}::uuid
      AND lease_token = ${job.lease_token}::uuid
      AND status = 'sending'
  `;
}

async function revokeGoneSubscription(job: PushDelivery) {
  await sql`
    DELETE FROM css_admin.staff_push_subscription
    WHERE id = ${job.subscription_id}::uuid
      AND owner_admin_user_id = ${job.owner_admin_user_id}
      AND device_id = ${job.device_id}::uuid
  `;
}

async function prune() {
  await sql`
    DELETE FROM css_admin.staff_push_subscription
    WHERE expires_at < now()
  `;
  await sql`
    DELETE FROM css_admin.staff_push_delivery
    WHERE (status IN ('sent','failed') AND created_at < now() - interval '7 days')
       OR (created_at < now() - interval '14 days')
  `;
}

async function deliver(job: PushDelivery) {
  // Recheck ownership again after claim. A device might have been rebound
  // to another admin while the network request was waiting.
  const owner = await sql`
    SELECT subscription.id FROM css_admin.staff_push_subscription subscription
    JOIN css_admin.export_job export_job ON export_job.id = ${job.job_id}::uuid
    WHERE subscription.id = ${job.subscription_id}::uuid
      AND subscription.owner_admin_user_id = export_job.owner_admin_user_id
      AND subscription.owner_admin_user_id = ${job.owner_admin_user_id}
      AND subscription.device_id = ${job.device_id}::uuid
      AND subscription.expires_at > now()
      AND export_job.status = 'ready'
      AND export_job.expires_at > now()
    LIMIT 1
  `;
  if (!owner.length) {
    await markFailed(job, "recipient_changed", false);
    return;
  }

  try {
    const sub = openPushSubscription(
      job.sealed_subscription, job.owner_admin_user_id, job.device_id,
    );
    const status = await sendExportReadyPush(sub);
    if ([200, 201, 202, 204].includes(status)) {
      await markSent(job);
    } else if ([404, 410].includes(status)) {
      await revokeGoneSubscription(job);
    } else {
      await markFailed(job, "http_" + status, status === 429 || status >= 500);
    }
  } catch {
    // Do not expose the endpoint, crypto keys or provider response bodies.
    await markFailed(job, "transport_or_key_error", true);
  }
}

async function main() {
  await checkSchema();
  if (PREFLIGHT) {
    // Read-only: validates crypto config and database migration; no claims.
    console.log("[staff-push] PREFLIGHT OK; keys=verified schema=ready; no notifications claimed.");
    await sql.end({ timeout: 5 });
    return;
  }
  console.log("[staff-push] started; queue=postgres, audience=staff, concurrency=1");
  let iteration = 0;
  while (!stopped) {
    try {
      await recoverExpiredLeases();
      if (iteration++ % 12 === 0) await discoverReadyExports();
      if (iteration % 120 === 1) await prune();
      const job = await claim();
      if (job) {
        await deliver(job);
        continue;
      }
    } catch {
      console.error("[staff-push] queue unavailable or delivery failed; retrying.");
    }
    await new Promise<void>(resolve => setTimeout(resolve, 5000));
  }
  await sql.end({ timeout: 5 });
}

main().catch(() => {
  console.error("[staff-push] fatal configuration or startup failure.");
  process.exitCode = 1;
});

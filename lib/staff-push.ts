import { randomUUID } from "node:crypto";
import { getLocalPostgres, hasLocalPostgres } from "@/lib/local-postgres";
import { endpointHash, sealPushSubscription, validatedPushSubscription, verifiedVapidPublicKey } from "@/lib/staff-push-crypto";

export const PUSH_DEVICE_COOKIE = "css_admin_push_device";
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function validStaffPushDevice(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function staffPushPublicOrigin() {
  const raw = process.env.CSS_ADMIN_PUSH_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    // The declared public origin is trusted configuration, not a client-
    // controlled X-Forwarded-* header from an upstream proxy.
    if (parsed.origin !== raw || parsed.pathname !== "/" ||
        parsed.username || parsed.password || parsed.search || parsed.hash ||
        (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") ||
        !["http:", "https:"].includes(parsed.protocol)) return null;
    return raw;
  } catch { return null; }
}

export function staffPushAvailable() {
  return process.env.CSS_ADMIN_PUSH_ENABLED === "1" &&
    Boolean(staffPushPublicOrigin()) &&
    hasLocalPostgres() &&
    Boolean(process.env.CSS_ADMIN_PUSH_ENCRYPTION_KEY?.trim()) &&
    Boolean(process.env.CSS_ADMIN_PUSH_VAPID_PUBLIC_KEY?.trim());
}

export function publicPushConfig() {
  return {
    enabled: staffPushAvailable(),
    publicKey: staffPushAvailable() ? verifiedVapidPublicKey() : null,
  };
}

export async function pushSubscribedOnDevice(ownerId: number, deviceId: string | null) {
  if (!validStaffPushDevice(deviceId)) return false;
  const sql = getLocalPostgres();
  const rows = await sql`
    SELECT id FROM css_admin.staff_push_subscription
    WHERE owner_admin_user_id = ${ownerId}
      AND device_id = ${deviceId}::uuid
      AND expires_at > now()
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function registerStaffPush(
  ownerId: number, deviceId: string, browserSubscription: unknown,
) {
  if (!staffPushAvailable() || !validStaffPushDevice(deviceId) ||
      !Number.isSafeInteger(ownerId) || ownerId < 1) {
    throw new Error("Staff push is not configured.");
  }
  const sub = validatedPushSubscription(browserSubscription);
  const hash = endpointHash(sub.endpoint);
  const sealed = sealPushSubscription(sub, ownerId, deviceId);
  const sql = getLocalPostgres();
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(43532027, ${ownerId})`;
    const current = await tx`
      SELECT id FROM css_admin.staff_push_subscription
      WHERE owner_admin_user_id = ${ownerId}
        AND (device_id = ${deviceId}::uuid OR endpoint_hash = ${hash})
      LIMIT 1
    `;
    const count = await tx`
      SELECT count(*)::integer AS total
      FROM css_admin.staff_push_subscription
      WHERE owner_admin_user_id = ${ownerId}
        AND expires_at > now()
    `;
    if (!current.length && Number(count[0].total) >= 5) {
      throw new Error("At most five devices can receive export notifications.");
    }
    // A shared browser's token is proof of device cookie possession.
    // Drop stale endpoint associations, including any previous account on
    // the same device. Cascades delete unsent events for that device.
    await tx`
      DELETE FROM css_admin.staff_push_subscription
      WHERE device_id = ${deviceId}::uuid
        AND endpoint_hash <> ${hash}
    `;
    await tx`
      INSERT INTO css_admin.staff_push_subscription (
        id, owner_admin_user_id, device_id,
        endpoint_hash, sealed_subscription, expires_at
      ) VALUES (
        ${randomUUID()}, ${ownerId}, ${deviceId}::uuid,
        ${hash}, ${sealed}, now() + interval '90 days'
      )
      ON CONFLICT (endpoint_hash) DO UPDATE SET
        owner_admin_user_id = EXCLUDED.owner_admin_user_id,
        device_id = EXCLUDED.device_id,
        sealed_subscription = EXCLUDED.sealed_subscription,
        updated_at = now(),
        expires_at = EXCLUDED.expires_at
    `;
  });
}

export async function revokeStaffPushDevice(ownerId: number, deviceId: string | null) {
  if (!validStaffPushDevice(deviceId)) return;
  const sql = getLocalPostgres();
  await sql`
    DELETE FROM css_admin.staff_push_subscription
    WHERE owner_admin_user_id = ${ownerId}
      AND device_id = ${deviceId}::uuid
  `;
}

export async function revokeStaffPushDeviceByCookie(deviceId: string | null) {
  if (!validStaffPushDevice(deviceId) || !hasLocalPostgres()) return;
  // The randomly generated HttpOnly device cookie is itself the revocation
  // credential; session clear also clears this cookie.
  const sql = getLocalPostgres();
  await sql`
    DELETE FROM css_admin.staff_push_subscription
    WHERE device_id = ${deviceId}::uuid
  `;
}

export function newStaffPushDevice() { return randomUUID(); }

export function staffPushCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  };
}

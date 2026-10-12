import { cookies } from "next/headers";
import {
  PUSH_DEVICE_COOKIE, revokeStaffPushDeviceByCookie,
  staffPushCookieOptions,
} from "@/lib/staff-push";

const ADMIN_TOKEN_COOKIE = "css_admin_token";
const COMPANY_TOKEN_COOKIE = "css_company_token";
const ADMIN_AUTH_RETRY_COOKIE = "css_admin_auth_retry";
const ADMIN_AUTH_RETRY_SECONDS = 300;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getAdminToken() {
  return (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}

export async function getCompanyToken() {
  return (await cookies()).get(COMPANY_TOKEN_COOKIE)?.value ?? null;
}

export async function hasAdminAuthRetryMarker() {
  return (await cookies()).get(ADMIN_AUTH_RETRY_COOKIE)?.value === "1";
}

export async function setAdminAuthRetryMarker() {
  (await cookies()).set(ADMIN_AUTH_RETRY_COOKIE, "1", {
    ...cookieOptions(),
    maxAge: ADMIN_AUTH_RETRY_SECONDS,
  });
}

// Revoke the push device associated with the current browser before its
// principal changes. A shared device must not keep receiving the old Staff
// user's alerts after logout, account switch or session expiry.
async function revokeCurrentPushDevice(store: Awaited<ReturnType<typeof cookies>>) {
  const deviceId = store.get(PUSH_DEVICE_COOKIE)?.value ?? null;
  if (deviceId) {
    try { await revokeStaffPushDeviceByCookie(deviceId); }
    catch {
      // Session changes must still complete if PostgreSQL is unavailable.
      // No push secrets/endpoint are written to logs.
    }
  }
  store.set(PUSH_DEVICE_COOKIE, "", { ...staffPushCookieOptions(), maxAge: 0 });
}

export async function setAdminToken(token: string) {
  const store = await cookies();
  await revokeCurrentPushDevice(store);
  store.set(ADMIN_TOKEN_COOKIE, token, cookieOptions());
  store.set(COMPANY_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function setCompanyToken(token: string) {
  const store = await cookies();
  await revokeCurrentPushDevice(store);
  store.set(COMPANY_TOKEN_COOKIE, token, cookieOptions());
  store.set(ADMIN_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function clearAdminToken() {
  (await cookies()).set(ADMIN_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function clearCompanyToken() {
  (await cookies()).set(COMPANY_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function clearSession() {
  const store = await cookies();
  await revokeCurrentPushDevice(store);
  store.set(ADMIN_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  store.set(COMPANY_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  store.set(ADMIN_AUTH_RETRY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

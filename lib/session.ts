import { cookies } from "next/headers";

const ADMIN_TOKEN_COOKIE = "css_admin_token";
const COMPANY_TOKEN_COOKIE = "css_company_token";

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

export async function setAdminToken(token: string) {
  const store = await cookies();
  store.set(ADMIN_TOKEN_COOKIE, token, cookieOptions());
  store.set(COMPANY_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function setCompanyToken(token: string) {
  const store = await cookies();
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
  store.set(ADMIN_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  store.set(COMPANY_TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

import { cookies } from "next/headers";

const ADMIN_TOKEN_COOKIE = "css_admin_token";

export async function getAdminToken() {
  return (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}

export async function setAdminToken(token: string) {
  (await cookies()).set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAdminToken() {
  (await cookies()).set(ADMIN_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

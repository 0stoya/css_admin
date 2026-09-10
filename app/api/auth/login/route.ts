import { NextResponse } from "next/server";
import { requestMagentoAdminToken } from "@/lib/magento/admin-auth";
import { requestMagentoCustomerToken } from "@/lib/magento/customer-auth";
import { setAdminToken, setCompanyToken } from "@/lib/session";

type LoginMode = "admin" | "company";

function isLoginMode(value: unknown): value is LoginMode {
  return value === "admin" || value === "company";
}

export async function POST(request: Request) {
  let payload: { mode?: unknown; login?: unknown; username?: unknown; password?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  if (!isLoginMode(payload.mode)) {
    return NextResponse.json({ error: "A valid sign-in type is required." }, { status: 400 });
  }

  const rawLogin = typeof payload.login === "string"
    ? payload.login
    : typeof payload.username === "string"
      ? payload.username
      : "";
  const login = rawLogin.trim();
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!login || !password) {
    const identifier = payload.mode === "company" ? "Email and password" : "Login and password";
    return NextResponse.json({ error: `${identifier} are required.` }, { status: 400 });
  }

  try {
    if (payload.mode === "company") {
      const token = await requestMagentoCustomerToken(login, password);
      await setCompanyToken(token);
      return NextResponse.json({ ok: true, destination: "/portal" });
    }

    const token = await requestMagentoAdminToken(login, password);
    await setAdminToken(token);
    return NextResponse.json({ ok: true, destination: "/companies" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

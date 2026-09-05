import { NextResponse } from "next/server";
import { requestMagentoAdminToken } from "@/lib/magento/admin-auth";
import { setAdminToken } from "@/lib/session";

export async function POST(request: Request) {
  let payload: { username?: unknown; password?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  try {
    const token = await requestMagentoAdminToken(username, password);
    await setAdminToken(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

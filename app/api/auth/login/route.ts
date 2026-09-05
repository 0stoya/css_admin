import { NextResponse } from "next/server";
import { requestMagentoAdminToken } from "@/lib/magento/admin-auth";
import { requestMagentoCustomerToken } from "@/lib/magento/customer-auth";
import { setAdminToken, setCompanyToken } from "@/lib/session";

type AccountType = "staff" | "company";

export async function POST(request: Request) {
  let payload: { username?: unknown; password?: unknown; account_type?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const accountType: AccountType = payload.account_type === "company" ? "company" : "staff";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  try {
    if (accountType === "company") {
      const token = await requestMagentoCustomerToken(username, password);
      await setCompanyToken(token);
      return NextResponse.json({ ok: true, destination: "/portal" });
    }

    const token = await requestMagentoAdminToken(username, password);
    await setAdminToken(token);
    return NextResponse.json({ ok: true, destination: "/companies" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

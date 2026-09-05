import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET(request: Request) {
  await clearSession();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", "expired");

  return NextResponse.redirect(loginUrl, 303);
}

import { NextResponse } from "next/server";
import { clearAdminToken } from "@/lib/session";

export async function GET(request: Request) {
  await clearAdminToken();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", "expired");

  return NextResponse.redirect(loginUrl, 303);
}

import { NextResponse } from "next/server";
import { clearAdminToken } from "@/lib/session";

export async function POST(request: Request) {
  await clearAdminToken();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

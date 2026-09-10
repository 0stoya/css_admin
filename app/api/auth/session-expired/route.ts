import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  await clearSession();

  return new NextResponse(null, {
    status: 303,
    headers: { Location: mode === "company" ? "/portal/login?reason=expired" : "/login?reason=expired" },
  });
}

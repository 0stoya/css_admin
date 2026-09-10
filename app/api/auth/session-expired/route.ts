import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function GET() {
  await clearSession();
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/login?reason=expired" },
  });
}

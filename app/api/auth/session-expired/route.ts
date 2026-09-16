import { NextResponse } from "next/server";
import { clearSession, setAdminAuthRetryMarker } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isAuthorizationRetry = url.searchParams.get("reason") === "authorization";

  await clearSession();
  if (isAuthorizationRetry) {
    await setAdminAuthRetryMarker();
  }

  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/login?reason=expired" },
  });
}

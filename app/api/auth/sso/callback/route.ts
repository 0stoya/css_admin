import { NextResponse, type NextRequest } from "next/server";
import { consumeAppSwitchState, isAppSwitchValue } from "@/lib/app-switch-session";
import {
  exchangeCustomerAppSwitch,
  validateCompanyCustomerToken,
} from "@/lib/graphql/customer-app-switch";
import { setCompanyToken } from "@/lib/session";

export const dynamic = "force-dynamic";

function localRedirect(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const verifier = await consumeAppSwitchState(request.nextUrl.searchParams.get("state"));
  if (!isAppSwitchValue(code) || !verifier) return localRedirect("/login?reason=app-switch");

  try {
    const token = await exchangeCustomerAppSwitch(code, "PORTAL", verifier);
    if (!(await validateCompanyCustomerToken(token))) return localRedirect("/login?reason=app-switch");
    await setCompanyToken(token);
    return localRedirect("/portal");
  } catch {
    return localRedirect("/login?reason=app-switch");
  }
}

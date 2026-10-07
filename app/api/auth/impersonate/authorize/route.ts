import { NextResponse, type NextRequest } from "next/server";
import { isAppSwitchValue } from "@/lib/app-switch-session";
import { getStorefrontUrl } from "@/lib/config";
import {
  createCustomerAppSwitch,
  getCustomerSupportContext,
  selectCustomerCompany,
  validateCompanyCustomerToken,
} from "@/lib/graphql/customer-app-switch";
import { GraphQLRequestError } from "@/lib/graphql/client";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { generateCustomerTokenAsAdmin } from "@/lib/graphql/customer-impersonation";
import { getAdminToken } from "@/lib/session";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

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

function failure(companyId: number | null, message: string) {
  const params = new URLSearchParams({ error: message });
  const path = companyId
    ? `/companies/${companyId}/management?${params.toString()}`
    : `/companies?${params.toString()}`;
  return localRedirect(path);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof GraphQLRequestError) {
    return error.message.slice(0, 220);
  }
  return "Shop as customer could not be started.";
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const challenge = request.nextUrl.searchParams.get("code_challenge");
  const companyId = positiveInteger(request.nextUrl.searchParams.get("companyId"));
  const userId = positiveInteger(request.nextUrl.searchParams.get("userId"));

  if (!(await getAdminToken())) return localRedirect("/login?reason=expired");
  if (!companyId || !userId || !isAppSwitchValue(state) || !isAppSwitchValue(challenge)) {
    return failure(companyId, "The Shop as customer request was invalid.");
  }

  try {
    const management = await getCompanyManagement(companyId);
    const user = management.users.find((candidate) => candidate.user_id === userId);
    if (!user) {
      return failure(companyId, "The selected customer is not a member of this company.");
    }

    // Magento customer-token revocation is customer-wide (and JWT revocation is
    // timestamp based), so this short-lived server-side bootstrap token must not\n    // be cleaned up with customer-wide token revocation. It never enters the browser or URL.
    const customerToken = await generateCustomerTokenAsAdmin(user.email);
    const supportContext = await getCustomerSupportContext(customerToken);
    const expectedEmail = user.email.trim().toLocaleLowerCase();
    if (
      !supportContext.authenticated
      || !supportContext.isCompanyCustomer
      || supportContext.email.toLocaleLowerCase() !== expectedEmail
      || !supportContext.companyIds.includes(companyId)
    ) {
      return failure(companyId, "Magento did not authenticate the selected company customer.");
    }

    if (supportContext.selectedCompanyId !== companyId) {
      if (supportContext.cartQuantity > 0) {
        return failure(
          companyId,
          "The customer has items in their basket under another company. Empty the basket before starting this support session.",
        );
      }
      await selectCustomerCompany(customerToken, companyId);
    }

    if (!(await validateCompanyCustomerToken(customerToken, user.email, companyId))) {
      return failure(companyId, "Magento did not select the requested company context.");
    }

    const code = await createCustomerAppSwitch(customerToken, "STORE", challenge);
    const callbackUrl = new URL("/api/auth/impersonate/callback", getStorefrontUrl());
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(callbackUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return failure(companyId, safeErrorMessage(error));
  }
}

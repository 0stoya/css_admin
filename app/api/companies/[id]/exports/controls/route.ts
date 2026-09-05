import { NextResponse } from "next/server";
import { GraphQLRequestError } from "@/lib/graphql/client";
import { getCompanyControlsBundle } from "@/lib/graphql/company-controls";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });

  try {
    const bundle = await getCompanyControlsBundle(companyId);
    return new Response(`${JSON.stringify(bundle, null, 2)}\n`, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="company-${companyId}-controls-v${bundle.schema_version}.json"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.status === 401) {
      return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
    }
    return new Response(error instanceof Error ? error.message : "Company-controls export failed.", { status: 403 });
  }
}

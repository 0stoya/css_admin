import { NextResponse } from "next/server";
import { exportCompanyUsersCsv } from "@/lib/company-user-import";
import { GraphQLRequestError } from "@/lib/graphql/client";
import { getCompanyManagement } from "@/lib/graphql/company-management";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });

  try {
    const management = await getCompanyManagement(companyId);
    return new Response(exportCompanyUsersCsv(management.users), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="company-${companyId}-users.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.status === 401) {
      return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
    }
    return new Response(error instanceof Error ? error.message : "Company-user export failed.", { status: 403 });
  }
}

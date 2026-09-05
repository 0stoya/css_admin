import { NextResponse } from "next/server";
import { GraphQLRequestError } from "@/lib/graphql/client";

export function csvDownload(content: string, filename: string) {
  return new Response(content, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export function adminCsvError(error: unknown, request: Request, fallback: string) {
  if (error instanceof GraphQLRequestError && error.status === 401) {
    return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
  }
  return new Response(error instanceof Error ? error.message : fallback, { status: 403 });
}

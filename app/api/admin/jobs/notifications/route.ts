import { NextResponse } from "next/server";
import { currentStaffJobIdentity } from "@/lib/admin-job-auth";
import { hasExportJobStore, ownerReadyNotifications } from "@/lib/admin-export-jobs";
import { GraphQLRequestError } from "@/lib/graphql/client";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (!hasExportJobStore()) {
    return NextResponse.json({ ready: [], count: 0 }, { headers });
  }
  try {
    const actor = await currentStaffJobIdentity();
    const ready = await ownerReadyNotifications(actor.user_id);
    return NextResponse.json({ ready, count: ready.length }, { headers });
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.status === 401) {
      return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
    }
    return NextResponse.json({ error: "Job notifications unavailable" }, { status: 503, headers });
  }
}

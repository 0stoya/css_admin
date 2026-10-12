import { NextResponse } from "next/server";
import { buildCompanyStructure, findCompanyStructureContext, flattenCompanyStructure } from "@/lib/company-structure";
import { getAllCompanies } from "@/lib/graphql/companies";
import { GraphQLRequestError } from "@/lib/graphql/client";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { getCompanyControlsBundle } from "@/lib/graphql/company-controls";
import { getAdminToken } from "@/lib/session";
import { makeCompanyStructureSnapshotSheets, type StructureSnapshotCompany } from "@/lib/company-structure-snapshot";
import { createSnapshotXlsx } from "@/lib/simple-xlsx";

const MAX_GROUP_COMPANIES = 80;
const CONCURRENCY = 2;
const noStore = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

async function loadGroupData(companies: StructureSnapshotCompany["company"][]) {
  const records: StructureSnapshotCompany[] = new Array(companies.length);
  let next = 0;
  async function worker() {
    while (next < companies.length) {
      const index = next++;
      const company = companies[index];
      const [management, controls] = await Promise.all([
        getCompanyManagement(company.company_id),
        getCompanyControlsBundle(company.company_id),
      ]);
      if (management.company_id !== company.company_id || controls.company_id !== company.company_id) {
        throw new Error("Snapshot data did not match company " + company.company_id + ".");
      }
      records[index] = { company, management, controls };
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, companies.length) }, worker));
  return records;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rawId = (await params).id;
  const companyId = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(companyId) || companyId <= 0) {
    return new Response("Invalid company ID.", { status: 400, headers: noStore });
  }
  if (!(await getAdminToken())) {
    return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
  }

  try {
    // The current Admin token defines the visible company set. We never
    // promote a customer's company membership or a presentation snapshot.
    const visible = await getAllCompanies();
    const context = findCompanyStructureContext(buildCompanyStructure(visible), companyId);
    if (!context || context.root.descendant_count === 0) {
      return new Response("This company has no multi-company structure to export.", { status: 422, headers: noStore });
    }
    if (context.root.company.parent_company_id !== null) {
      return new Response("The group head is outside the visible Admin scope. Cannot export this structure.", { status: 403, headers: noStore });
    }

    const members = flattenCompanyStructure(context.root).map((entry) => entry.company);
    if (members.length > MAX_GROUP_COMPANIES) {
      return new Response("Group snapshot is limited to " + MAX_GROUP_COMPANIES + " companies per workbook.", { status: 422, headers: noStore });
    }

    const startedAt = new Date().toISOString();
    const records = await loadGroupData(members);
    const finishedAt = new Date().toISOString();
    const workbook = createSnapshotXlsx(makeCompanyStructureSnapshotSheets(
      context.root.company, records, startedAt, finishedAt,
    ));
    const reference = (context.root.company.reference || "company-" + context.root.company.company_id)
      .replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
    const filename = "company-structure-" + reference + "-" + finishedAt.slice(0, 10) + ".xlsx";

    return new Response(Uint8Array.from(workbook), {
      headers: {
        ...noStore,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (error) {
    if (error instanceof GraphQLRequestError && error.status === 401) {
      return NextResponse.redirect(new URL("/api/auth/session-expired", request.url), 303);
    }
    console.error("[company-structure-snapshot] Export failed; no partial workbook returned.", error);
    return new Response("Company structure snapshot unavailable. No partial workbook was produced.", {
      status: 502,
      headers: noStore,
    });
  }
}

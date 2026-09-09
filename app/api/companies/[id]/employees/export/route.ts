import { getCompanyEmployeeExport } from "@/lib/graphql/company-employees";
import { employeeExportCsv } from "@/lib/company-employees-csv";
import { getAdminToken } from "@/lib/session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });

  if (!(await getAdminToken())) {
    return Response.redirect(new URL("/login?reason=expired", request.url), 303);
  }

  const url = new URL(request.url);
  const activeParam = url.searchParams.get("active");
  const active = activeParam === "1" ? true : activeParam === "0" ? false : undefined;

  try {
    const rows = await getCompanyEmployeeExport(companyId, active);
    const csv = employeeExportCsv(rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="company-${companyId}-employees.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Employee export failed.", { status: 502 });
  }
}

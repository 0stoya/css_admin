import { employeeExportCsv } from "@/lib/company-employees-csv";
import { getPortalEmployeeExport } from "@/lib/graphql/company-portal-employees";
import { getCompanyToken } from "@/lib/session";

export async function GET(request: Request) {
  if (!(await getCompanyToken())) return Response.redirect(new URL("/login?reason=expired", request.url), 303);

  const url = new URL(request.url);
  const activeParam = url.searchParams.get("active");
  const active = activeParam === "1" ? true : activeParam === "0" ? false : undefined;

  try {
    const rows = await getPortalEmployeeExport(active);
    return new Response(employeeExportCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=company-employees.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Employee export failed.", { status: 502 });
  }
}

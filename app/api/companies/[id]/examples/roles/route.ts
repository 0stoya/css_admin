import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleRolesPermissionsCsv } from "@/lib/flat-company-imports";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement } from "@/lib/graphql/company-management";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = Number((await params).id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });
  try {
    const [company, management] = await Promise.all([getCompany(companyId), getCompanyManagement(companyId)]);
    return csvDownload(exampleRolesPermissionsCsv(company, management), `company-${companyId}-roles-example.csv`);
  } catch (error) { return adminCsvError(error, request, "Role example failed."); }
}

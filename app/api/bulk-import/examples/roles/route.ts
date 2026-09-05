import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleRolesPermissionsCsv, firstReferencedCompany } from "@/lib/flat-company-imports";
import { getCompanyManagement } from "@/lib/graphql/company-management";

export async function GET(request: Request) {
  try {
    const company = await firstReferencedCompany();
    const management = await getCompanyManagement(company.company_id);
    return csvDownload(exampleRolesPermissionsCsv(company, management), "bulk-company-roles-example.csv");
  } catch (error) { return adminCsvError(error, request, "Bulk role example failed."); }
}

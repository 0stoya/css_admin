import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleUsersFlatCsv, firstReferencedCompany } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { const company = await firstReferencedCompany(); return csvDownload(exampleUsersFlatCsv(company.reference), "bulk-company-users-example.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk company-user example failed."); }
}

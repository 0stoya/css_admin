import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleRoleProductsCsv, firstReferencedCompany } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { const company = await firstReferencedCompany(); return csvDownload(exampleRoleProductsCsv(company.reference), "bulk-role-products-example.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk role-product example failed."); }
}

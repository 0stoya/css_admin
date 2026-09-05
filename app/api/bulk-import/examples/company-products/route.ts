import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleCompanyProductsCsv, firstReferencedCompany } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { const company = await firstReferencedCompany(); return csvDownload(exampleCompanyProductsCsv(company.reference), "bulk-company-products-example.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk company-product example failed."); }
}

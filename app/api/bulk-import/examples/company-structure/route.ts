import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleBulkCompanyStructureCsv } from "@/lib/company-structure-import";

export async function GET(request: Request) {
  try {
    return csvDownload(await exampleBulkCompanyStructureCsv(), "bulk-company-structure-example.csv");
  } catch (error) {
    return adminCsvError(error, request, "Bulk company-structure example failed.");
  }
}

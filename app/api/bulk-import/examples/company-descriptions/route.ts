import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { companyDescriptionExampleCsv } from "@/lib/company-description-import";

export async function GET(request: Request) {
  try {
    return csvDownload(
      companyDescriptionExampleCsv(),
      "bulk-company-descriptions-example.csv",
    );
  } catch (error) {
    return adminCsvError(error, request, "Bulk company-description example failed.");
  }
}

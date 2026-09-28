import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportBulkCompanyDescriptionsCsv } from "@/lib/company-description-import";

export async function GET(request: Request) {
  try {
    return csvDownload(
      await exportBulkCompanyDescriptionsCsv(),
      "bulk-company-descriptions.csv",
    );
  } catch (error) {
    return adminCsvError(error, request, "Bulk company-description export failed.");
  }
}

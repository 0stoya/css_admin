import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportBulkUsersCsv } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { return csvDownload(await exportBulkUsersCsv(), "bulk-company-users.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk company-user export failed."); }
}

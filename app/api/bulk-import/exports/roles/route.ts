import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportBulkRolesCsv } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { return csvDownload(await exportBulkRolesCsv(), "bulk-company-roles.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk role export failed."); }
}

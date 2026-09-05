import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportBulkRoleProductsCsv } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { return csvDownload(await exportBulkRoleProductsCsv(), "bulk-role-products.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk role-product export failed."); }
}

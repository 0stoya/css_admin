import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportBulkCompanyProductsCsv } from "@/lib/flat-company-imports";

export async function GET(request: Request) {
  try { return csvDownload(await exportBulkCompanyProductsCsv(), "bulk-company-products.csv"); }
  catch (error) { return adminCsvError(error, request, "Bulk company-product export failed."); }
}

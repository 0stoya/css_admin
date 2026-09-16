import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportBulkPurchaseControlsCsv } from "@/lib/bulk-purchase-controls";

export async function GET(request: Request) {
  try {
    return csvDownload(
      await exportBulkPurchaseControlsCsv(),
      "bulk-purchase-controls.csv",
    );
  } catch (error) {
    return adminCsvError(error, request, "Bulk purchase-controls export failed.");
  }
}

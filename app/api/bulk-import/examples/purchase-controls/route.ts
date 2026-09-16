import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { firstReferencedCompany } from "@/lib/flat-company-imports";
import { exampleBulkPurchaseControlsCsv } from "@/lib/bulk-purchase-controls";

export async function GET(request: Request) {
  try {
    const company = await firstReferencedCompany();
    return csvDownload(
      exampleBulkPurchaseControlsCsv(company.reference),
      "bulk-purchase-controls-example.csv",
    );
  } catch (error) {
    return adminCsvError(error, request, "Bulk purchase-controls example failed.");
  }
}

import { exportBulkCompanyStructureCsv } from "@/lib/company-structure-import";
import { graphQLErrorMessage } from "@/lib/graphql/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return new Response(await exportBulkCompanyStructureCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="css-company-structure.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(graphQLErrorMessage(error), {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

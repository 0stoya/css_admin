import { exampleCompanyControlsCsv } from "@/lib/company-controls-csv";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });

  return new Response(exampleCompanyControlsCsv(), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": "attachment; filename=company-controls-import-example.csv",
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

import { stringifyCsv } from "@/lib/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });

  const rows: Array<Array<string | number>> = [
    ["email", "role_name", "manager_email", "approval_type", "approval_threshold"],
    ["buyer@example.com", "Buyer", "approver@example.com", "value", 250],
    ["approver@example.com", "Approver", "", "all", ""],
  ];

  return new Response(`\uFEFF${stringifyCsv(rows)}\r\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": "attachment; filename=company-users-import-example.csv",
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

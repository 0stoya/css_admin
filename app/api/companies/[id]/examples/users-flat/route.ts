import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exampleUsersFlatCsv } from "@/lib/flat-company-imports";
import { getCompany } from "@/lib/graphql/companies";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = Number((await params).id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });
  try {
    const company = await getCompany(companyId);
    if (!company.reference?.trim()) throw new Error("Company reference is required.");
    return csvDownload(exampleUsersFlatCsv(company.reference.trim()), `company-${companyId}-users-example.csv`);
  } catch (error) { return adminCsvError(error, request, "Company-user example failed."); }
}

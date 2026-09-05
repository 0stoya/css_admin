import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportCompanyProductsCsv } from "@/lib/flat-company-imports";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyControlsBundle } from "@/lib/graphql/company-controls";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = Number((await params).id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });
  try {
    const [company, controls] = await Promise.all([getCompany(companyId), getCompanyControlsBundle(companyId)]);
    return csvDownload(exportCompanyProductsCsv(company, controls), `company-${companyId}-products.csv`);
  } catch (error) { return adminCsvError(error, request, "Company-product export failed."); }
}

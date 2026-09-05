import { adminCsvError, csvDownload } from "@/lib/admin-csv-route";
import { exportRoleProductsCsv } from "@/lib/flat-company-imports";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyControlsBundle } from "@/lib/graphql/company-controls";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = Number((await params).id);
  if (!Number.isInteger(companyId) || companyId <= 0) return new Response("Invalid company ID.", { status: 400 });
  try {
    const [company, controls] = await Promise.all([getCompany(companyId), getCompanyControlsBundle(companyId)]);
    return csvDownload(exportRoleProductsCsv(company, controls), `company-${companyId}-role-products.csv`);
  } catch (error) { return adminCsvError(error, request, "Role-product export failed."); }
}

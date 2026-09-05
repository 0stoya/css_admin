import Link from "next/link";
import { getCompanies } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";

export default async function CompaniesPage() {
  try {
    const companies = await getCompanies();

    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">Authenticated Magento scope</p>
            <h1>Companies</h1>
            <p className="muted">{companies.total_count} compan{companies.total_count === 1 ? "y" : "ies"} visible to this admin account.</p>
          </div>
        </header>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Reference</th>
                <th>Company ID</th>
                <th>Sales rep ID</th>
              </tr>
            </thead>
            <tbody>
              {companies.items.map((company) => (
                <tr key={company.company_id}>
                  <td><Link className="row-link" href={`/companies/${company.company_id}`}>{company.name}</Link></td>
                  <td>{company.reference || "—"}</td>
                  <td>{company.company_id}</td>
                  <td>{company.sales_representative_id ?? "Unassigned"}</td>
                </tr>
              ))}
              {companies.items.length === 0 ? (
                <tr><td colSpan={4}>No companies are available in this admin scope.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </>
    );
  } catch (error) {
    return (
      <section className="card stack">
        <div>
          <p className="eyebrow">Backend request failed</p>
          <h1>Companies unavailable</h1>
        </div>
        <div className="error">{graphQLErrorMessage(error)}</div>
      </section>
    );
  }
}

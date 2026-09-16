import { CompanyDirectory } from "@/components/company-directory";
import { buildCompanyStructure } from "@/lib/company-structure";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getAllCompanies } from "@/lib/graphql/companies";

type CompanyFilter = "enabled" | "all";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function companyFilter(value: string | undefined): CompanyFilter {
  return value === "all" ? "all" : "enabled";
}

async function loadCompanies(status?: boolean) {
  try {
    const companies = await getAllCompanies(100, status);
    return { companies, error: null };
  } catch (error) {
    return { companies: null, error: graphQLErrorMessage(error) };
  }
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filter = companyFilter(firstParam(query.status));
  const { companies, error } = await loadCompanies(filter === "enabled" ? true : undefined);

  if (!companies) {
    return (
      <section className="card stack">
        <div>
          <p className="eyebrow">Backend request failed</p>
          <h1>Companies unavailable</h1>
        </div>
        <div className="error">{error}</div>
      </section>
    );
  }

  const structures = buildCompanyStructure(companies);
  const groupedCompanies = structures.filter((root) => root.children.length > 0).length;

  return (
    <div className="stack section-gap">
      <header className="page-header company-directory-header">
        <div>
          <p className="eyebrow">Authenticated Magento scope</p>
          <h1>Companies</h1>
          <p className="muted">
            {companies.length} {filter === "enabled" ? "enabled " : ""}compan{companies.length === 1 ? "y" : "ies"} visible across {structures.length} company structure{structures.length === 1 ? "" : "s"}.
          </p>
        </div>
        {groupedCompanies ? (
          <div className="company-directory-key">
            <span><strong>{groupedCompanies}</strong> grouped structure{groupedCompanies === 1 ? "" : "s"}</span>
          </div>
        ) : null}
      </header>

      {companies.length ? (
        <CompanyDirectory roots={structures} filterMode={filter} />
      ) : (
        <section className="card">
          <p className="muted">No {filter === "enabled" ? "enabled " : ""}companies are available in this admin scope.</p>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanySettings,
  getCompanySettingsOptions,
  type CompanySettings,
  type CompanySettingsOptions,
} from "@/lib/graphql/company-settings";
import { deleteCompanyAction, updateCompanySettingsAction } from "./actions";

type SearchParams = Promise<{
  notice?: string;
  error?: string;
}>;

async function loadCompany(companyId: number) {
  try {
    return { company: await getCompanySettings(companyId), error: null };
  } catch (error) {
    return { company: null, error: graphQLErrorMessage(error) };
  }
}

async function loadOptions() {
  try {
    return { options: await getCompanySettingsOptions(), error: null };
  } catch (error) {
    return { options: null, error: graphQLErrorMessage(error) };
  }
}

function addressSummary(company: CompanySettings) {
  return [
    company.street,
    company.city,
    company.region,
    company.postcode,
    company.country_code,
  ].filter(Boolean).join(", ") || "—";
}

function customerGroupLabel(company: CompanySettings, options: CompanySettingsOptions | null) {
  const current = options?.customer_groups.find(
    (group) => group.customer_group_id === company.customer_group_id,
  );
  return current ? `${current.code} (#${current.customer_group_id})` : company.customer_group_id ?? "—";
}

export default async function CompanySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    notFound();
  }

  const [{ company, error: companyError }, { options, error: optionsError }, query] = await Promise.all([
    loadCompany(companyId),
    loadOptions(),
    searchParams,
  ]);

  if (!company) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company</Link></div>
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Company settings unavailable</h1>
          </div>
          <div className="error">{companyError}</div>
        </section>
      </div>
    );
  }

  const currentCustomerGroupMissing = company.customer_group_id !== null
    && !options?.customer_groups.some(
      (group) => group.customer_group_id === company.customer_group_id,
    );

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link>
        <span>/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name || `Company ${company.company_id}`}</Link>
        <span>/</span>
        <span>Settings</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Company settings & lifecycle</h1>
          <p className="muted">Only Magento-local fields are editable here. OGL-owned company data remains read-only.</p>
        </div>
      </header>

      {query.notice ? <div className="notice">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className="card stack">
        <div>
          <h2>OGL-owned company data</h2>
          <p className="muted">These values come from the onboarding/sync contract and are intentionally not editable on this screen.</p>
        </div>
        <dl className="detail-list">
          <dt>Reference / CREF</dt><dd>{company.reference || "—"}</dd>
          <dt>Name</dt><dd>{company.name || "—"}</dd>
          <dt>Status</dt><dd>{company.status ? "Enabled" : "Disabled"}</dd>
          <dt>Email</dt><dd>{company.email || "—"}</dd>
          <dt>Telephone</dt><dd>{company.telephone || "—"}</dd>
          <dt>Address</dt><dd>{addressSummary(company)}</dd>
          <dt>Administrator customer ID</dt><dd>{company.admin_customer_id ?? "—"}</dd>
          <dt>Sales representative ID</dt><dd>{company.sales_representative_id ?? "Unassigned"}</dd>
        </dl>
        <p className="muted">Change OGL sync, rep mappings or imported-company rep overrides from <Link href="/ogl">OGL administration</Link>.</p>
      </section>

      <section className="card stack">
        <div>
          <h2>Magento-local configuration</h2>
          <p className="muted">These fields are outside the current OGL update writer and can be maintained locally.</p>
        </div>

        {options ? (
          <form action={updateCompanySettingsAction} className="form">
            <input type="hidden" name="companyId" value={company.company_id} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="customerGroupId">Customer group</label>
                <select id="customerGroupId" name="customerGroupId" defaultValue={String(company.customer_group_id ?? "")} required>
                  {company.customer_group_id === null ? <option value="">Select a customer group</option> : null}
                  {currentCustomerGroupMissing ? (
                    <option value={company.customer_group_id ?? ""}>Current group (#{company.customer_group_id})</option>
                  ) : null}
                  {options.customer_groups.map((group) => (
                    <option key={group.customer_group_id} value={group.customer_group_id}>
                      {group.code} (#{group.customer_group_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="vatTaxId">VAT tax ID</label>
                <input id="vatTaxId" name="vatTaxId" defaultValue={company.vat_tax_id ?? ""} />
              </div>

              <div className="field">
                <label htmlFor="parentCompanyId">Parent company ID</label>
                <input id="parentCompanyId" name="parentCompanyId" type="number" min="1" defaultValue={company.parent_company_id ?? ""} />
              </div>

              <label className="check-field">
                <input name="showCompanyLandingPage" type="checkbox" defaultChecked={company.show_company_landing_page} />
                <span>
                  <strong>Show company landing page</strong>
                  <small className="muted">Magento-local company presentation setting.</small>
                </span>
              </label>

              <div className="field span-2">
                <label htmlFor="comment">Comment</label>
                <textarea id="comment" name="comment" rows={3} defaultValue={company.comment ?? ""} />
              </div>

              <div className="field span-2">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows={4} defaultValue={company.description ?? ""} />
              </div>

              <div className="field span-2">
                <label htmlFor="homepageContent">Homepage content</label>
                <textarea id="homepageContent" name="homepageContent" rows={6} defaultValue={company.homepage_content ?? ""} />
              </div>
            </div>
            <button className="button" type="submit">Save local settings</button>
          </form>
        ) : (
          <div className="stack">
            <div className="error">{optionsError}</div>
            <dl className="detail-list">
              <dt>Customer group</dt><dd>{customerGroupLabel(company, null)}</dd>
              <dt>VAT tax ID</dt><dd>{company.vat_tax_id || "—"}</dd>
              <dt>Parent company ID</dt><dd>{company.parent_company_id ?? "—"}</dd>
              <dt>Landing page</dt><dd>{company.show_company_landing_page ? "Shown" : "Hidden"}</dd>
              <dt>Comment</dt><dd>{company.comment || "—"}</dd>
              <dt>Description</dt><dd>{company.description || "—"}</dd>
            </dl>
            <p className="muted">The backend did not grant company-management access, so local settings remain read-only.</p>
          </div>
        )}
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h2>Delete company</h2>
          <p className="muted">Deletion is backend-authoritative. OGL-backed companies cannot be deleted while OGL sync is enabled.</p>
        </div>

        {company.reference ? (
          <form action={deleteCompanyAction} className="form">
            <input type="hidden" name="companyId" value={company.company_id} />
            <input type="hidden" name="expectedReference" value={company.reference} />
            <div className="field">
              <label htmlFor="confirmReference">Type {company.reference} to confirm</label>
              <input id="confirmReference" name="confirmReference" autoComplete="off" required />
            </div>
            <p className="muted">If sync is enabled, the backend will reject the delete. Disable sync in <Link href={`/ogl?search=${encodeURIComponent(company.reference)}`}>OGL administration</Link>, then retry. A successful delete retains the CREF registry row and clears its imported company link.</p>
            <button className="button button-danger" type="submit">Delete company</button>
          </form>
        ) : (
          <div className="error">This company has no reference, so the exact-reference deletion contract cannot be satisfied.</div>
        )}
      </section>
    </div>
  );
}

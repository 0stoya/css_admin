import Link from "next/link";
import {
  getOglCompanies,
  getOglCompanyPreview,
  getOglRepMappings,
  type OglCompanyPreview,
} from "@/lib/graphql/ogl";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  deleteOglRepMappingAction,
  fetchOglCompaniesAction,
  importAllEnabledOglCompaniesAction,
  importSelectedOglCompaniesAction,
  saveOglRepMappingAction,
  setOglCompanyRepOverrideAction,
  setOglCompanySyncAction,
} from "./actions";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function triState(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function positivePage(value: string | undefined) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function companyAdminName(preview: OglCompanyPreview) {
  const name = `${preview.admin_firstname ?? ""} ${preview.admin_lastname ?? ""}`.trim();
  return name || "—";
}

function buildOglHref(
  base: { search?: string; sync?: string; imported?: string },
  changes: { page?: number; cref?: string | null },
) {
  const params = new URLSearchParams();
  if (base.search) params.set("search", base.search);
  if (base.sync && base.sync !== "all") params.set("sync", base.sync);
  if (base.imported && base.imported !== "all") params.set("imported", base.imported);
  if (changes.page && changes.page > 1) params.set("page", String(changes.page));
  if (changes.cref) params.set("cref", changes.cref);
  const query = params.toString();
  return query ? `/ogl?${query}` : "/ogl";
}

async function loadOglRegistry(
  page: number,
  search?: string,
  syncEnabled?: boolean,
  imported?: boolean,
) {
  try {
    const [registry, mappings] = await Promise.all([
      getOglCompanies(page, 100, search, syncEnabled, imported),
      getOglRepMappings(),
    ]);
    return { registry, mappings, error: null };
  } catch (error) {
    return { registry: null, mappings: null, error: graphQLErrorMessage(error) };
  }
}

async function loadPreview(cref?: string) {
  if (!cref) return { preview: null, error: null };
  try {
    return { preview: await getOglCompanyPreview(cref), error: null };
  } catch (error) {
    return { preview: null, error: graphQLErrorMessage(error) };
  }
}

export default async function OglAdministrationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const search = firstParam(query.search)?.trim();
  const syncFilter = firstParam(query.sync) ?? "all";
  const importedFilter = firstParam(query.imported) ?? "all";
  const selectedCref = firstParam(query.cref)?.trim();
  const page = positivePage(firstParam(query.page));
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);
  const baseFilters = { search, sync: syncFilter, imported: importedFilter };

  const [{ registry, mappings, error }, previewState] = await Promise.all([
    loadOglRegistry(page, search, triState(syncFilter), triState(importedFilter)),
    loadPreview(selectedCref),
  ]);

  if (!registry || !mappings) {
    return (
      <section className="card stack">
        <div>
          <p className="eyebrow">Backend request failed</p>
          <h1>OGL administration unavailable</h1>
          <p className="muted">This area requires the existing Fluid OGL company ACL.</p>
        </div>
        <div className="error">{error}</div>
      </section>
    );
  }

  const enabledOnPage = registry.items.filter((company) => company.sync_enabled).length;
  const importedOnPage = registry.items.filter((company) => company.imported).length;

  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fluid OGL company administration</p>
          <h1>OGL companies</h1>
          <p className="muted">
            Company onboarding is OGL-only. Fetch the registry, preview source data, then enable sync to queue the initial import.
          </p>
        </div>
        <div className="pagination-actions">
          <form action={fetchOglCompaniesAction}>
            <button className="button button-secondary" type="submit" disabled={!registry.ogl_enabled || !registry.company_import_enabled}>
              Fetch OGL registry
            </button>
          </form>
          <form action={importAllEnabledOglCompaniesAction}>
            <button className="button" type="submit" disabled={!registry.ogl_enabled || !registry.company_import_enabled}>
              Queue all enabled
            </button>
          </form>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{registry.total_count}</span>
          <span className="stat-label">Registry matches</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{importedOnPage}</span>
          <span className="stat-label">Imported on this page</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{enabledOnPage}</span>
          <span className="stat-label">Sync enabled on this page</span>
        </div>
      </div>

      <section className="card stack">
        <div className="card-heading-row">
          <div>
            <h2>Import availability</h2>
            <p className="muted">These flags come directly from the Fluid OGL configuration.</p>
          </div>
          <div className="pagination-actions">
            <span className={`badge ${registry.ogl_enabled ? "badge-ok" : "badge-restricted"}`}>
              OGL {registry.ogl_enabled ? "enabled" : "disabled"}
            </span>
            <span className={`badge ${registry.company_import_enabled ? "badge-ok" : "badge-restricted"}`}>
              Company import {registry.company_import_enabled ? "enabled" : "disabled"}
            </span>
          </div>
        </div>
      </section>

      <section className="stack">
        <div className="section-heading">
          <div>
            <h2>Registry</h2>
            <p className="muted">Enabling sync queues an immediate import. Only sync-enabled CREFs are eligible for later queue actions.</p>
          </div>
        </div>

        <form className="card form-grid" method="get">
          <div className="field span-2">
            <label htmlFor="search">CREF search</label>
            <input id="search" name="search" defaultValue={search} placeholder="Company reference" />
          </div>
          <div className="field">
            <label htmlFor="sync">Sync state</label>
            <select id="sync" name="sync" defaultValue={syncFilter}>
              <option value="all">All</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="imported">Import state</label>
            <select id="imported" name="imported" defaultValue={importedFilter}>
              <option value="all">All</option>
              <option value="true">Imported</option>
              <option value="false">Not imported</option>
            </select>
          </div>
          <div className="span-2">
            <button className="button button-secondary" type="submit">Apply filters</button>
          </div>
        </form>

        <form id="batch-import-form" action={importSelectedOglCompaniesAction} className="inline-form">
          <button className="button" type="submit" disabled={!registry.company_import_enabled}>Queue selected enabled CREFs</button>
          <span className="muted small-text">Selection is limited to sync-enabled rows on the current page.</span>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>CREF</th>
                <th>Import</th>
                <th>Sync</th>
                <th>Sales rep</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registry.items.map((company) => (
                <tr key={company.cref}>
                  <td>
                    <input
                      aria-label={`Select ${company.cref}`}
                      form="batch-import-form"
                      name="crefs"
                      type="checkbox"
                      value={company.cref}
                      disabled={!company.sync_enabled}
                    />
                  </td>
                  <td>
                    <div className="cell-stack">
                      <Link className="row-link" href={buildOglHref(baseFilters, { page, cref: company.cref })}>{company.cref}</Link>
                      {company.company_id ? <Link className="small-text" href={`/companies/${company.company_id}`}>Magento company #{company.company_id}</Link> : null}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${company.imported ? "badge-ok" : "badge-neutral"}`}>
                      {company.imported ? "Imported" : "Not imported"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${company.sync_enabled ? "badge-ok" : "badge-neutral"}`}>
                      {company.sync_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{company.sales_representative_source}</span>
                      <span className="muted small-text">OGL code {company.ogl_rep_code || "—"}</span>
                      <span className="muted small-text">Effective admin #{company.effective_sales_representative_id ?? "—"}</span>
                    </div>
                  </td>
                  <td>{company.updated_at || "—"}</td>
                  <td>
                    <form action={setOglCompanySyncAction}>
                      <input name="cref" type="hidden" value={company.cref} />
                      <input name="enabled" type="hidden" value={company.sync_enabled ? "0" : "1"} />
                      <button className={`button ${company.sync_enabled ? "button-secondary" : ""}`} type="submit" disabled={!registry.company_import_enabled && !company.sync_enabled}>
                        {company.sync_enabled ? "Disable sync" : "Enable + queue"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!registry.items.length ? <tr><td colSpan={7}>No OGL companies match the current filters.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <span className="muted small-text">
            Page {registry.page_info.current_page} of {Math.max(registry.page_info.total_pages, 1)} · up to {registry.page_info.page_size} rows per page
          </span>
          <div className="pagination-actions">
            {registry.page_info.current_page > 1 ? (
              <Link className="button button-link button-secondary" href={buildOglHref(baseFilters, { page: registry.page_info.current_page - 1, cref: null })}>Previous</Link>
            ) : null}
            {registry.page_info.current_page < registry.page_info.total_pages ? (
              <Link className="button button-link button-secondary" href={buildOglHref(baseFilters, { page: registry.page_info.current_page + 1, cref: null })}>Next</Link>
            ) : null}
          </div>
        </div>
      </section>

      {selectedCref ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Live OGL preview · {selectedCref}</h2>
              <p className="muted">Preview fetches the current OGL company payload and designated administrator before import.</p>
            </div>
            <Link className="back-link" href={buildOglHref(baseFilters, { page, cref: null })}>Close preview</Link>
          </div>

          {previewState.error ? <div className="error">{previewState.error}</div> : null}
          {previewState.preview ? (
            <div className="grid">
              <article className="card stack">
                <div className="card-heading-row">
                  <div>
                    <p className="eyebrow">OGL source</p>
                    <h3>{previewState.preview.company_name || previewState.preview.cref}</h3>
                  </div>
                  <span className={`badge ${previewState.preview.importable ? "badge-ok" : "badge-restricted"}`}>
                    {previewState.preview.importable ? "Importable" : "Unavailable"}
                  </span>
                </div>
                {previewState.preview.reason ? <div className="error">{previewState.preview.reason}</div> : null}
                <dl className="mini-detail-list">
                  <dt>CREF</dt><dd>{previewState.preview.cref}</dd>
                  <dt>OGL status</dt><dd>{previewState.preview.company_status === null ? "—" : previewState.preview.company_status ? "Enabled" : "Disabled"}</dd>
                  <dt>Existing company</dt><dd>{previewState.preview.existing_company_id ?? "—"}</dd>
                  <dt>Website</dt><dd>{previewState.preview.website_id ?? "—"}</dd>
                  <dt>Credit limit</dt><dd>{displayValue(previewState.preview.credit_limit)}</dd>
                  <dt>Balance</dt><dd>{displayValue(previewState.preview.balance)}</dd>
                  <dt>Cash sale</dt><dd>{previewState.preview.cash_sale === null ? "—" : previewState.preview.cash_sale ? "Yes" : "No"}</dd>
                  <dt>Delivery code</dt><dd>{displayValue(previewState.preview.delivery_code)}</dd>
                </dl>
                <form action={setOglCompanySyncAction}>
                  <input name="cref" type="hidden" value={previewState.preview.cref} />
                  <input name="enabled" type="hidden" value={previewState.preview.sync_enabled ? "0" : "1"} />
                  <button className={`button ${previewState.preview.sync_enabled ? "button-secondary" : ""}`} type="submit" disabled={!previewState.preview.importable && !previewState.preview.sync_enabled}>
                    {previewState.preview.sync_enabled ? "Disable OGL sync" : "Enable sync + queue import"}
                  </button>
                </form>
              </article>

              <article className="card stack">
                <div><p className="eyebrow">Designated administrator</p><h3>{companyAdminName(previewState.preview)}</h3></div>
                <dl className="mini-detail-list">
                  <dt>Email</dt><dd>{displayValue(previewState.preview.admin_email)}</dd>
                  <dt>Telephone</dt><dd>{displayValue(previewState.preview.telephone)}</dd>
                  <dt>Address 1</dt><dd>{displayValue(previewState.preview.address_line_1)}</dd>
                  <dt>Address 2</dt><dd>{displayValue(previewState.preview.address_line_2)}</dd>
                  <dt>City</dt><dd>{displayValue(previewState.preview.city)}</dd>
                  <dt>Region</dt><dd>{displayValue(previewState.preview.region)}</dd>
                  <dt>Postcode</dt><dd>{displayValue(previewState.preview.postcode)}</dd>
                  <dt>Country</dt><dd>{displayValue(previewState.preview.country_code)}</dd>
                </dl>
              </article>

              <article className="card stack">
                <div><p className="eyebrow">Sales representative</p><h3>{previewState.preview.sales_representative_source}</h3></div>
                <dl className="mini-detail-list">
                  <dt>OGL rep code</dt><dd>{displayValue(previewState.preview.ogl_rep_code)}</dd>
                  <dt>Mapped admin</dt><dd>{previewState.preview.mapped_sales_representative_id ?? "—"}</dd>
                  <dt>Override admin</dt><dd>{previewState.preview.rep_override_user_id ?? "—"}</dd>
                  <dt>Effective admin</dt><dd>{previewState.preview.effective_sales_representative_id ?? "—"}</dd>
                </dl>
                {previewState.preview.existing_company_id ? (
                  <div className="stack">
                    <form action={setOglCompanyRepOverrideAction} className="compact-form">
                      <input name="cref" type="hidden" value={previewState.preview.cref} />
                      <input name="enabled" type="hidden" value="1" />
                      <div className="field">
                        <label htmlFor="overrideAdminUserId">Override Magento admin user ID</label>
                        <input id="overrideAdminUserId" name="adminUserId" type="number" min="1" step="1" defaultValue={previewState.preview.rep_override_user_id ?? ""} required />
                      </div>
                      <button className="button" type="submit">Save rep override</button>
                    </form>
                    {previewState.preview.rep_override_enabled ? (
                      <form action={setOglCompanyRepOverrideAction}>
                        <input name="cref" type="hidden" value={previewState.preview.cref} />
                        <input name="enabled" type="hidden" value="0" />
                        <button className="button button-secondary" type="submit">Remove override</button>
                      </form>
                    ) : null}
                  </div>
                ) : <p className="muted small-text">Rep overrides are available after the OGL company has been imported.</p>}
              </article>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="stack">
        <div className="section-heading">
          <div>
            <h2>OGL rep-code mappings</h2>
            <p className="muted">Mappings apply immediately to matching imported companies unless a company has an explicit override.</p>
          </div>
        </div>

        <form action={saveOglRepMappingAction} className="card form-grid">
          <div className="field">
            <label htmlFor="repCode">OGL rep code</label>
            <input id="repCode" name="repCode" maxLength={32} required />
          </div>
          <div className="field">
            <label htmlFor="adminUserId">Magento admin user ID</label>
            <input id="adminUserId" name="adminUserId" type="number" min="1" step="1" required />
          </div>
          <div className="span-2">
            <button className="button" type="submit">Save mapping</button>
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Rep code</th><th>Magento admin</th><th>State</th><th>Companies</th><th>Actions</th></tr></thead>
            <tbody>
              {mappings.map((mapping) => {
                const displayName = `${mapping.firstname ?? ""} ${mapping.lastname ?? ""}`.trim() || mapping.username || `Admin #${mapping.admin_user_id}`;
                return (
                  <tr key={mapping.rep_code}>
                    <td><strong>{mapping.rep_code}</strong></td>
                    <td><div className="cell-stack"><strong>{displayName}</strong><span className="muted small-text">{mapping.email || "—"} · #{mapping.admin_user_id}</span></div></td>
                    <td><span className={`badge ${mapping.active ? "badge-ok" : "badge-restricted"}`}>{mapping.active ? "Active" : "Inactive"}</span></td>
                    <td>{mapping.affected_company_count}</td>
                    <td>
                      <details className="mutation-panel">
                        <summary>Delete mapping</summary>
                        <form action={deleteOglRepMappingAction} className="compact-form danger-zone">
                          <input name="repCode" type="hidden" value={mapping.rep_code} />
                          <div className="field">
                            <label>Type {mapping.rep_code} to confirm</label>
                            <input name="confirmRepCode" autoComplete="off" required />
                          </div>
                          <button className="button button-danger" type="submit">Delete mapping</button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!mappings.length ? <tr><td colSpan={5}>No OGL rep-code mappings are configured.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

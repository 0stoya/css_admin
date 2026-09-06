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
import styles from "@/components/ogl-workspace.module.css";

type OglView = "companies" | "mappings";

type FilterState = {
  search?: string;
  sync?: string;
  imported?: string;
};

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

function viewParam(value: string | undefined): OglView {
  return value === "mappings" ? "mappings" : "companies";
}

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function companyAdminName(preview: OglCompanyPreview) {
  const name = `${preview.admin_firstname ?? ""} ${preview.admin_lastname ?? ""}`.trim();
  return name || "—";
}

function buildOglHref(
  base: FilterState,
  changes: { view?: OglView; page?: number; cref?: string | null } = {},
) {
  const params = new URLSearchParams();
  const view = changes.view ?? "companies";
  if (view === "mappings") params.set("view", "mappings");
  if (view === "companies") {
    if (base.search) params.set("search", base.search);
    if (base.sync && base.sync !== "all") params.set("sync", base.sync);
    if (base.imported && base.imported !== "all") params.set("imported", base.imported);
    if (changes.page && changes.page > 1) params.set("page", String(changes.page));
    if (changes.cref) params.set("cref", changes.cref);
  }
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
  const view = viewParam(firstParam(query.view));
  const search = firstParam(query.search)?.trim();
  const syncFilter = firstParam(query.sync) ?? "all";
  const importedFilter = firstParam(query.imported) ?? "all";
  const selectedCref = view === "companies" ? firstParam(query.cref)?.trim() : undefined;
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
          <p className="eyebrow">OGL operations</p>
          <h1>OGL administration</h1>
          <p className="muted">
            Control company onboarding, sync eligibility and sales-representative routing from the Fluid-authorized OGL boundary.
          </p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <div className={styles.workspace}>
        <nav className={styles.tabs} aria-label="OGL administration views">
          <Link
            className={`${styles.tab} ${view === "companies" ? styles.tabActive : ""}`}
            href="/ogl"
            aria-current={view === "companies" ? "page" : undefined}
          >
            Companies
            <span className={styles.tabCount}>{registry.total_count}</span>
          </Link>
          <Link
            className={`${styles.tab} ${view === "mappings" ? styles.tabActive : ""}`}
            href="/ogl?view=mappings"
            aria-current={view === "mappings" ? "page" : undefined}
          >
            Rep mappings
            <span className={styles.tabCount}>{mappings.length}</span>
          </Link>
        </nav>

        <div className={styles.healthStrip}>
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>OGL connection</span>
            <span className={styles.healthValue}>
              <span className={`${styles.healthDot} ${registry.ogl_enabled ? styles.healthDotOk : styles.healthDotBad}`} aria-hidden="true" />
              {registry.ogl_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>Company import</span>
            <span className={styles.healthValue}>
              <span className={`${styles.healthDot} ${registry.company_import_enabled ? styles.healthDotOk : styles.healthDotBad}`} aria-hidden="true" />
              {registry.company_import_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>Imported on page</span>
            <span className={styles.healthValue}>{importedOnPage} of {registry.items.length}</span>
          </div>
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>Sync enabled on page</span>
            <span className={styles.healthValue}>{enabledOnPage} of {registry.items.length}</span>
          </div>
        </div>

        {view === "companies" ? (
          <>
            <section className="stack">
              <div className={styles.sectionHeader}>
                <div>
                  <p className="eyebrow">Company onboarding</p>
                  <h2>Company registry</h2>
                  <p className="muted">Fetch the OGL registry, inspect source data and queue only companies whose sync is enabled.</p>
                </div>
                <div className={styles.headerActions}>
                  <form action={fetchOglCompaniesAction}>
                    <button className="button button-secondary" type="submit" disabled={!registry.ogl_enabled || !registry.company_import_enabled}>
                      Fetch registry
                    </button>
                  </form>
                  <form action={importAllEnabledOglCompaniesAction}>
                    <button className="button" type="submit" disabled={!registry.ogl_enabled || !registry.company_import_enabled}>
                      Queue all enabled
                    </button>
                  </form>
                </div>
              </div>

              <form className={styles.filterCard} method="get">
                <div className="field">
                  <label htmlFor="search">Find a company</label>
                  <input id="search" name="search" defaultValue={search} placeholder="CREF" />
                </div>
                <div className="field">
                  <label htmlFor="sync">Sync</label>
                  <select id="sync" name="sync" defaultValue={syncFilter}>
                    <option value="all">All states</option>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="imported">Import</label>
                  <select id="imported" name="imported" defaultValue={importedFilter}>
                    <option value="all">All states</option>
                    <option value="true">Imported</option>
                    <option value="false">Not imported</option>
                  </select>
                </div>
                <div className={styles.filterActions}>
                  <button className="button button-secondary" type="submit">Apply</button>
                  {(search || syncFilter !== "all" || importedFilter !== "all") ? (
                    <Link className="button button-link button-secondary" href="/ogl">Clear</Link>
                  ) : null}
                </div>
              </form>

              {selectedCref ? (
                <div className={styles.previewPanel}>
                  <div className={styles.previewHeader}>
                    <div>
                      <p className="eyebrow">Live OGL preview</p>
                      <h2>{previewState.preview?.company_name || selectedCref}</h2>
                      <p className="muted">Current OGL source data is read directly before import; this is not a cached Magento company view.</p>
                    </div>
                    <div className={styles.headerActions}>
                      {previewState.preview ? (
                        <span className={`badge ${previewState.preview.importable ? "badge-ok" : "badge-restricted"}`}>
                          {previewState.preview.importable ? "Importable" : "Unavailable"}
                        </span>
                      ) : null}
                      <Link className="button button-link button-secondary" href={buildOglHref(baseFilters, { page, cref: null })}>Close</Link>
                    </div>
                  </div>

                  {previewState.error ? <div className="error">{previewState.error}</div> : null}
                  {previewState.preview ? (
                    <>
                      {previewState.preview.reason ? <div className="error">{previewState.preview.reason}</div> : null}
                      <div className={styles.previewMeta}>
                        <span className={`badge ${previewState.preview.sync_enabled ? "badge-ok" : "badge-neutral"}`}>
                          Sync {previewState.preview.sync_enabled ? "enabled" : "disabled"}
                        </span>
                        {previewState.preview.existing_company_id ? (
                          <Link className="button button-link button-secondary" href={`/companies/${previewState.preview.existing_company_id}`}>
                            Open Magento company
                          </Link>
                        ) : null}
                        <form action={setOglCompanySyncAction}>
                          <input name="cref" type="hidden" value={previewState.preview.cref} />
                          <input name="enabled" type="hidden" value={previewState.preview.sync_enabled ? "0" : "1"} />
                          <button
                            className={`button ${previewState.preview.sync_enabled ? "button-secondary" : ""}`}
                            type="submit"
                            disabled={!previewState.preview.importable && !previewState.preview.sync_enabled}
                          >
                            {previewState.preview.sync_enabled ? "Disable sync" : "Enable sync + queue"}
                          </button>
                        </form>
                      </div>

                      <div className={styles.previewGrid}>
                        <article className={styles.previewCard}>
                          <div className={styles.previewCardHeader}>
                            <div><p className="eyebrow">OGL source</p><h3>{previewState.preview.cref}</h3></div>
                          </div>
                          <dl className={styles.detailGrid}>
                            <dt>Status</dt><dd>{previewState.preview.company_status === null ? "—" : previewState.preview.company_status ? "Enabled" : "Disabled"}</dd>
                            <dt>Website</dt><dd>{previewState.preview.website_id ?? "—"}</dd>
                            <dt>Credit limit</dt><dd>{displayValue(previewState.preview.credit_limit)}</dd>
                            <dt>Balance</dt><dd>{displayValue(previewState.preview.balance)}</dd>
                            <dt>Cash sale</dt><dd>{previewState.preview.cash_sale === null ? "—" : previewState.preview.cash_sale ? "Yes" : "No"}</dd>
                            <dt>Delivery code</dt><dd>{displayValue(previewState.preview.delivery_code)}</dd>
                          </dl>
                        </article>

                        <article className={styles.previewCard}>
                          <div><p className="eyebrow">Designated administrator</p><h3>{companyAdminName(previewState.preview)}</h3></div>
                          <dl className={styles.detailGrid}>
                            <dt>Email</dt><dd>{displayValue(previewState.preview.admin_email)}</dd>
                            <dt>Telephone</dt><dd>{displayValue(previewState.preview.telephone)}</dd>
                            <dt>Address</dt><dd>{[previewState.preview.address_line_1, previewState.preview.address_line_2].filter(Boolean).join(", ") || "—"}</dd>
                            <dt>City</dt><dd>{displayValue(previewState.preview.city)}</dd>
                            <dt>Region</dt><dd>{displayValue(previewState.preview.region)}</dd>
                            <dt>Postcode</dt><dd>{displayValue(previewState.preview.postcode)}</dd>
                            <dt>Country</dt><dd>{displayValue(previewState.preview.country_code)}</dd>
                          </dl>
                        </article>

                        <article className={styles.previewCard}>
                          <div><p className="eyebrow">Sales representative</p><h3>{previewState.preview.sales_representative_source}</h3></div>
                          <dl className={styles.detailGrid}>
                            <dt>OGL rep code</dt><dd>{displayValue(previewState.preview.ogl_rep_code)}</dd>
                            <dt>Mapped admin</dt><dd>{previewState.preview.mapped_sales_representative_id ?? "—"}</dd>
                            <dt>Override admin</dt><dd>{previewState.preview.rep_override_user_id ?? "—"}</dd>
                            <dt>Effective admin</dt><dd>{previewState.preview.effective_sales_representative_id ?? "—"}</dd>
                          </dl>
                          {previewState.preview.existing_company_id ? (
                            <div className={styles.overrideForm}>
                              <form action={setOglCompanyRepOverrideAction} className="compact-form">
                                <input name="cref" type="hidden" value={previewState.preview.cref} />
                                <input name="enabled" type="hidden" value="1" />
                                <div className="field">
                                  <label htmlFor="overrideAdminUserId">Override Magento admin user ID</label>
                                  <input
                                    id="overrideAdminUserId"
                                    name="adminUserId"
                                    type="number"
                                    min="1"
                                    step="1"
                                    defaultValue={previewState.preview.rep_override_user_id ?? ""}
                                    required
                                  />
                                </div>
                                <button className="button" type="submit">Save override</button>
                              </form>
                              {previewState.preview.rep_override_enabled ? (
                                <form action={setOglCompanyRepOverrideAction}>
                                  <input name="cref" type="hidden" value={previewState.preview.cref} />
                                  <input name="enabled" type="hidden" value="0" />
                                  <button className="button button-secondary" type="submit">Remove override</button>
                                </form>
                              ) : null}
                            </div>
                          ) : <p className="muted small-text">Rep overrides become available after the company has been imported.</p>}
                        </article>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.tableCard}>
                <div className={styles.tableToolbar}>
                  <div className={styles.tableToolbarText}>
                    <strong>{registry.total_count} matching OGL compan{registry.total_count === 1 ? "y" : "ies"}</strong>
                    <span>Select sync-enabled companies on this page to queue a targeted import.</span>
                  </div>
                  <form id="batch-import-form" action={importSelectedOglCompaniesAction} className={styles.toolbarActions}>
                    <button className="button" type="submit" disabled={!registry.company_import_enabled}>Queue selected</button>
                  </form>
                </div>

                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Company</th>
                        <th>Import</th>
                        <th>Sync</th>
                        <th>Sales rep</th>
                        <th>Updated</th>
                        <th>Action</th>
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
                            <div className={styles.companyCell}>
                              <Link className="row-link" href={buildOglHref(baseFilters, { page, cref: company.cref })}>
                                <strong>{company.cref}</strong>
                              </Link>
                              {company.company_id ? <Link className="small-text" href={`/companies/${company.company_id}`}>Magento company #{company.company_id}</Link> : <span className="muted small-text">Not imported</span>}
                            </div>
                          </td>
                          <td><span className={`badge ${company.imported ? "badge-ok" : "badge-neutral"}`}>{company.imported ? "Imported" : "Not imported"}</span></td>
                          <td><span className={`badge ${company.sync_enabled ? "badge-ok" : "badge-neutral"}`}>{company.sync_enabled ? "Enabled" : "Disabled"}</span></td>
                          <td>
                            <div className={styles.repCell}>
                              <strong>{company.sales_representative_source}</strong>
                              <span>OGL {company.ogl_rep_code || "—"} · Admin #{company.effective_sales_representative_id ?? "—"}</span>
                            </div>
                          </td>
                          <td>{company.updated_at || "—"}</td>
                          <td>
                            <div className={styles.rowActions}>
                              <Link className="button button-link button-secondary" href={buildOglHref(baseFilters, { page, cref: company.cref })}>Inspect</Link>
                              <form action={setOglCompanySyncAction}>
                                <input name="cref" type="hidden" value={company.cref} />
                                <input name="enabled" type="hidden" value={company.sync_enabled ? "0" : "1"} />
                                <button className={`button ${company.sync_enabled ? "button-secondary" : ""}`} type="submit" disabled={!registry.company_import_enabled && !company.sync_enabled}>
                                  {company.sync_enabled ? "Disable" : "Enable + queue"}
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!registry.items.length ? <tr><td colSpan={7}>No OGL companies match the current filters.</td></tr> : null}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <span className="muted small-text">
                    Page {registry.page_info.current_page} of {Math.max(registry.page_info.total_pages, 1)} · up to {registry.page_info.page_size} rows per page
                  </span>
                  <div className={styles.toolbarActions}>
                    {registry.page_info.current_page > 1 ? (
                      <Link className="button button-link button-secondary" href={buildOglHref(baseFilters, { page: registry.page_info.current_page - 1, cref: null })}>Previous</Link>
                    ) : null}
                    {registry.page_info.current_page < registry.page_info.total_pages ? (
                      <Link className="button button-link button-secondary" href={buildOglHref(baseFilters, { page: registry.page_info.current_page + 1, cref: null })}>Next</Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="stack">
            <div className={styles.mappingHeader}>
              <div>
                <p className="eyebrow">Sales representative routing</p>
                <h2>OGL rep-code mappings</h2>
                <p className="muted">Mappings update matching imported companies immediately unless that company has its own explicit override.</p>
              </div>
              <span className="badge badge-neutral">{mappings.length} mapping{mappings.length === 1 ? "" : "s"}</span>
            </div>

            <form action={saveOglRepMappingAction} className={styles.mappingForm}>
              <div className="field">
                <label htmlFor="repCode">OGL rep code</label>
                <input id="repCode" name="repCode" maxLength={32} placeholder="e.g. AB" required />
              </div>
              <div className="field">
                <label htmlFor="adminUserId">Magento admin user ID</label>
                <input id="adminUserId" name="adminUserId" type="number" min="1" step="1" required />
              </div>
              <button className="button" type="submit">Save mapping</button>
            </form>

            {mappings.length ? (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table>
                    <thead><tr><th>Rep code</th><th>Magento admin</th><th>State</th><th>Companies</th><th>Action</th></tr></thead>
                    <tbody>
                      {mappings.map((mapping) => {
                        const displayName = `${mapping.firstname ?? ""} ${mapping.lastname ?? ""}`.trim() || mapping.username || `Admin #${mapping.admin_user_id}`;
                        return (
                          <tr key={mapping.rep_code}>
                            <td><strong>{mapping.rep_code}</strong></td>
                            <td>
                              <div className={styles.mappingName}>
                                <strong>{displayName}</strong>
                                <span>{mapping.email || "—"} · Admin #{mapping.admin_user_id}</span>
                              </div>
                            </td>
                            <td><span className={`badge ${mapping.active ? "badge-ok" : "badge-restricted"}`}>{mapping.active ? "Active" : "Inactive"}</span></td>
                            <td>{mapping.affected_company_count}</td>
                            <td>
                              <details className="mutation-panel">
                                <summary>Delete</summary>
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
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>No rep-code mappings configured</strong>
                <span className="muted">Add a mapping above when an OGL sales-representative code should resolve to a Magento admin user.</span>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

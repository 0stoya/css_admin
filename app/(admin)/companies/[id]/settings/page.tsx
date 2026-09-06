import Link from "next/link";
import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanySettings,
  getCompanySettingsOptions,
  type CompanySettings,
  type CompanySettingsOptions,
} from "@/lib/graphql/company-settings";
import styles from "@/components/company-settings-workspace.module.css";
import { deleteCompanyAction, updateCompanySettingsAction } from "./actions";

type SettingsView = "overview" | "local" | "danger";

type SearchParams = Promise<{
  view?: string;
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

function settingsHref(companyId: number, view: SettingsView) {
  return `/companies/${companyId}/settings?view=${view}`;
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

  const activeView: SettingsView = query.view === "local" || query.view === "danger"
    ? query.view
    : "overview";
  const currentCustomerGroupMissing = company.customer_group_id !== null
    && !options?.customer_groups.some(
      (group) => group.customer_group_id === company.customer_group_id,
    );
  const groupLabel = customerGroupLabel(company, options);

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Company administration</p>
          <h1>Company settings</h1>
          <p className="muted">
            Review synced company data, maintain Magento-local settings and manage destructive lifecycle actions separately.
          </p>
        </div>
      </header>

      {query.notice ? <div className="notice">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <nav className={styles.tabs} aria-label="Company settings views">
        <Link
          className={`${styles.tab} ${activeView === "overview" ? styles.tabActive : ""}`}
          href={settingsHref(companyId, "overview")}
        >
          Company data
        </Link>
        <Link
          className={`${styles.tab} ${activeView === "local" ? styles.tabActive : ""}`}
          href={settingsHref(companyId, "local")}
        >
          Local settings
        </Link>
        <Link
          className={`${styles.tab} ${activeView === "danger" ? styles.tabActive : ""}`}
          href={settingsHref(companyId, "danger")}
        >
          Danger zone
        </Link>
      </nav>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span>Reference</span>
          <strong>{company.reference || "—"}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Company status</span>
          <strong>{company.status ? "Enabled" : "Disabled"}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>Customer group</span>
          <strong>{groupLabel}</strong>
        </div>
      </div>

      {activeView === "overview" ? (
        <section className={`card ${styles.sectionCard}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Synced company record</p>
              <h2>Company data</h2>
              <p className="muted">
                These identity and contact fields are owned by the onboarding/OGL sync contract and remain read-only here.
              </p>
            </div>
            <span className="badge badge-neutral">Read only</span>
          </div>

          <div className={styles.identityGrid}>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Company name</span>
              <strong>{company.name || "—"}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Reference / CREF</span>
              <strong>{company.reference || "—"}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Email</span>
              <strong>{company.email || "—"}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Telephone</span>
              <strong>{company.telephone || "—"}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Address</span>
              <strong>{addressSummary(company)}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Company administrator</span>
              <strong>{company.admin_customer_id ? `Customer #${company.admin_customer_id}` : "—"}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Sales representative</span>
              <strong>{company.sales_representative_id ? `Rep #${company.sales_representative_id}` : "Unassigned"}</strong>
            </div>
            <div className={styles.identityItem}>
              <span className={styles.metaLabel}>Magento company ID</span>
              <strong>#{company.company_id}</strong>
            </div>
          </div>

          <div className={styles.ownershipNote}>
            <div>
              <strong>OGL-owned values are intentionally protected</strong>
              <span className="muted">
                Sync state, representative mappings and imported-company overrides are maintained in OGL administration.
              </span>
            </div>
            <Link className="button button-secondary button-link" href="/ogl">
              Open OGL administration
            </Link>
          </div>
        </section>
      ) : null}

      {activeView === "local" ? (
        <section className={`card ${styles.sectionCard}`}>
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Magento-local configuration</p>
              <h2>Local settings</h2>
              <p className="muted">
                These fields are outside the current OGL writer and can be maintained directly for this company.
              </p>
            </div>
            <span className="badge badge-ok">Editable</span>
          </div>

          <div className={styles.parentCard}>
            <div>
              <span className={styles.metaLabel}>Company hierarchy</span>
              <strong>
                {company.parent_company_id
                  ? <>Parent <Link href={`/companies/${company.parent_company_id}`}>company #{company.parent_company_id}</Link></>
                  : "Root company — no parent"}
              </strong>
              <span className="muted">
                Parent relationships are managed through the company-structure workflow and are preserved when these settings are saved.
              </span>
            </div>
            <Link className="button button-secondary button-link" href="/bulk-import#company-structure">
              Manage hierarchy
            </Link>
          </div>

          {options ? (
            <form action={updateCompanySettingsAction} className={styles.localForm}>
              <input type="hidden" name="companyId" value={company.company_id} />
              <div className={styles.localGrid}>
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

                <label className={`check-field ${styles.spanTwo}`}>
                  <input name="showCompanyLandingPage" type="checkbox" defaultChecked={company.show_company_landing_page} />
                  <span>
                    <strong>Show company landing page</strong>
                    <small className="muted">Controls the Magento-local company presentation setting.</small>
                  </span>
                </label>

                <div className={`field ${styles.spanTwo}`}>
                  <label htmlFor="comment">Internal comment</label>
                  <textarea id="comment" name="comment" rows={3} defaultValue={company.comment ?? ""} />
                </div>

                <div className={`field ${styles.spanTwo}`}>
                  <label htmlFor="description">Company description</label>
                  <textarea id="description" name="description" rows={4} defaultValue={company.description ?? ""} />
                </div>

                <div className={`field ${styles.spanTwo}`}>
                  <label htmlFor="homepageContent">Homepage content</label>
                  <textarea id="homepageContent" name="homepageContent" rows={6} defaultValue={company.homepage_content ?? ""} />
                </div>
              </div>

              <div className={styles.saveBar}>
                <p className="muted small-text">
                  Saving local settings never changes the company reference, synced identity/contact data or hierarchy.
                </p>
                <button className="button" type="submit">Save local settings</button>
              </div>
            </form>
          ) : (
            <div className="stack">
              <div className="error">{optionsError}</div>
              <div className={styles.readOnlyGrid}>
                <div><span>Customer group</span><strong>{customerGroupLabel(company, null)}</strong></div>
                <div><span>VAT tax ID</span><strong>{company.vat_tax_id || "—"}</strong></div>
                <div><span>Landing page</span><strong>{company.show_company_landing_page ? "Shown" : "Hidden"}</strong></div>
                <div><span>Comment</span><strong>{company.comment || "—"}</strong></div>
                <div><span>Description</span><strong>{company.description || "—"}</strong></div>
                <div><span>Homepage content</span><strong>{company.homepage_content ? "Configured" : "—"}</strong></div>
              </div>
              <p className="muted">
                Fluid did not return the company settings options, so this configuration remains read-only.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {activeView === "danger" ? (
        <section className={`card ${styles.dangerCard}`}>
          <div className={styles.dangerHeader}>
            <div>
              <p className="eyebrow">Company lifecycle</p>
              <h2>Delete company</h2>
              <p className="muted">
                Deletion is backend-authoritative and permanently removes the Magento company record when Fluid allows it.
              </p>
            </div>
            <span className={styles.dangerBadge}>Destructive action</span>
          </div>

          {company.reference ? (
            <div className={styles.confirmBox}>
              <div>
                <strong>Deletion requires the exact company reference</strong>
                <p className="muted small-text">
                  OGL-backed companies cannot be deleted while OGL sync is enabled. Disable sync first if Fluid rejects the operation.
                </p>
              </div>
              <form action={deleteCompanyAction} className="form">
                <input type="hidden" name="companyId" value={company.company_id} />
                <input type="hidden" name="expectedReference" value={company.reference} />
                <div className="field">
                  <label htmlFor="confirmReference">Type {company.reference} to confirm</label>
                  <input id="confirmReference" name="confirmReference" autoComplete="off" required />
                </div>
                <p className="muted small-text">
                  A successful delete retains the CREF registry row and clears its imported-company link.
                </p>
                <div className="button-row">
                  <button className="button button-danger" type="submit">Delete company</button>
                  <Link
                    className="button button-secondary button-link"
                    href={`/ogl?search=${encodeURIComponent(company.reference)}`}
                  >
                    Check OGL sync
                  </Link>
                </div>
              </form>
            </div>
          ) : (
            <div className="error">
              This company has no reference, so the exact-reference deletion contract cannot be satisfied.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

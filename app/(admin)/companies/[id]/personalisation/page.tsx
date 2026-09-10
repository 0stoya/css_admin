import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getAdminCompanyPresentation } from "@/lib/graphql/company-presentation";
import {
  clearCompanyPresentationMediaAction,
  saveCompanyPresentationAction,
  uploadCompanyPresentationMediaAction,
} from "./actions";
import styles from "@/components/company-personalisation-workspace.module.css";

function initials(name: string | null) {
  return (name || "Rep").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function address(parts: Array<string | null>) {
  return parts.filter(Boolean).join(", ") || "—";
}

export default async function CompanyPersonalisationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId < 1) notFound();

  let presentation;
  try {
    presentation = await getAdminCompanyPresentation(companyId);
  } catch (error) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Backend request failed</p><h1>Personalisation unavailable</h1></div>
        <div className="error">{graphQLErrorMessage(error)}</div>
      </section>
    );
  }

  const rep = presentation.rep_contacts[0] ?? null;
  const bannerStyle = presentation.banner_url
    ? { backgroundImage: `linear-gradient(rgb(0 35 72 / 28%), rgb(0 35 72 / 28%)), url("${presentation.banner_url}")` }
    : undefined;

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Company experience</p>
          <h1>Personalisation</h1>
          <p className="muted">
            Brand the company portal and preview the account representative resolved from the existing OGL rep assignment.
          </p>
        </div>
      </header>

      {query.notice ? <div className="notice" role="status">{query.notice}</div> : null}
      {query.error ? <div className="error" role="alert">{query.error}</div> : null}

      <div className={styles.grid}>
        <div className="stack">
          <section className={`card ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <p className="eyebrow">Company page</p>
                <h2>Portal content</h2>
                <p className="muted">Welcome and description reuse the existing Fluid company landing-page fields; the extra branding fields are CSS-owned.</p>
              </div>
              <span className={`badge ${presentation.enabled ? "badge-ok" : "badge-neutral"}`}>
                {presentation.enabled ? "Visible" : "Hidden"}
              </span>
            </div>

            <form action={saveCompanyPresentationAction} className={styles.formGrid}>
              <input type="hidden" name="companyId" value={companyId} />
              <label className={styles.toggleRow}>
                <span className={styles.toggleText}>
                  <strong>Enable personalised company page</strong>
                  <small className="muted">Controls whether this company uses its landing-page presentation.</small>
                </span>
                <input name="enabled" type="checkbox" defaultChecked={presentation.enabled} aria-label="Enable personalised company page" />
              </label>

              <div className="field">
                <label htmlFor="portalTitle">Portal title</label>
                <input id="portalTitle" name="portalTitle" maxLength={255} defaultValue={presentation.portal_title ?? ""} placeholder={presentation.company_name ?? "Company portal"} />
              </div>
              <div className="field">
                <label htmlFor="welcomeHeading">Welcome heading</label>
                <input id="welcomeHeading" name="welcomeHeading" maxLength={255} defaultValue={presentation.welcome_heading ?? ""} placeholder="Welcome to your PPE ordering portal" />
              </div>
              <div className={`field ${styles.spanTwo}`}>
                <label htmlFor="welcomeText">Welcome text</label>
                <textarea id="welcomeText" name="welcomeText" rows={5} defaultValue={presentation.welcome_text ?? ""} />
              </div>
              <div className={`field ${styles.spanTwo}`}>
                <label htmlFor="companyDescription">Company description</label>
                <textarea id="companyDescription" name="companyDescription" rows={5} defaultValue={presentation.company_description ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="contactPhone">Display telephone</label>
                <input id="contactPhone" name="contactPhone" maxLength={64} defaultValue={presentation.contact_phone ?? ""} placeholder={presentation.company_phone ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="contactEmail">Display email</label>
                <input id="contactEmail" name="contactEmail" type="email" maxLength={255} defaultValue={presentation.contact_email ?? ""} placeholder={presentation.company_email ?? ""} />
              </div>
              <div className={`field ${styles.spanTwo}`}>
                <label htmlFor="procurementEmail">Procurement email</label>
                <input id="procurementEmail" name="procurementEmail" type="email" maxLength={255} defaultValue={presentation.procurement_email ?? ""} />
              </div>
              <div className={`${styles.saveBar} ${styles.spanTwo}`}>
                <button className="button" type="submit">Save personalisation</button>
              </div>
            </form>
          </section>

          <section className={`card ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div><p className="eyebrow">Brand assets</p><h2>Logo and banner</h2><p className="muted">JPEG, PNG or WebP, up to 3 MB. Files are stored in Magento media under the CSS namespace.</p></div>
            </div>
            <div className={styles.mediaGrid}>
              {(["LOGO", "BANNER"] as const).map((kind) => {
                const url = kind === "LOGO" ? presentation.logo_url : presentation.banner_url;
                return (
                  <article className={styles.mediaCard} key={kind}>
                    <div className={styles.mediaPreview}>
                      {url ? <img src={url} alt={`${kind === "LOGO" ? "Company logo" : "Company banner"} preview`} /> : <span className="muted">No {kind.toLowerCase()} uploaded</span>}
                    </div>
                    <div className={styles.mediaBody}>
                      <strong>{kind === "LOGO" ? "Company logo" : "Portal banner"}</strong>
                      <form action={uploadCompanyPresentationMediaAction} className="stack">
                        <input type="hidden" name="companyId" value={companyId} />
                        <input type="hidden" name="kind" value={kind} />
                        <input className={styles.fileInput} name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
                        <button className="button button-secondary" type="submit">Upload {kind.toLowerCase()}</button>
                      </form>
                      {url ? (
                        <form action={clearCompanyPresentationMediaAction}>
                          <input type="hidden" name="companyId" value={companyId} />
                          <input type="hidden" name="kind" value={kind} />
                          <button className="button button-secondary" type="submit">Remove</button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className={`card ${styles.previewCard}`}>
            <div className={styles.banner} style={bannerStyle}>
              {presentation.logo_url ? <img className={styles.logo} src={presentation.logo_url} alt="Company logo" /> : null}
            </div>
            <div className={styles.previewBody}>
              <div>
                <p className="eyebrow">Live preview</p>
                <h2>{presentation.portal_title || presentation.company_name || "Company portal"}</h2>
                <h3>{presentation.welcome_heading || "Welcome"}</h3>
                {presentation.welcome_text ? <p>{presentation.welcome_text}</p> : <p className="muted">Add welcome text to introduce the company ordering portal.</p>}
              </div>
              <div className={styles.companyDetails}>
                <div className={styles.detail}><span>Company</span><strong>{presentation.company_name || "—"}</strong></div>
                <div className={styles.detail}><span>Reference</span><strong>{presentation.company_reference || "—"}</strong></div>
                <div className={styles.detail}><span>Telephone</span><strong>{presentation.contact_phone || "—"}</strong></div>
                <div className={styles.detail}><span>Email</span><strong>{presentation.contact_email || "—"}</strong></div>
                <div className={`${styles.detail} ${styles.spanTwo}`}><span>Address</span><strong>{address([presentation.street, presentation.city, presentation.region, presentation.postcode, presentation.country_code])}</strong></div>
              </div>
              {rep ? (
                <div className={styles.repCard}>
                  {rep.image_url ? <img className={styles.repPhoto} src={rep.image_url} alt={`${rep.name} profile`} /> : <div className={styles.repInitials} aria-hidden="true">{initials(rep.name)}</div>}
                  <div className={styles.repBody}>
                    <span className="muted small-text">Your account representative</span>
                    <strong>{rep.name}</strong>
                    <span>{rep.job_title || "Account Manager"}</span>
                    {rep.phone ? <a href={`tel:${rep.phone}`}>{rep.phone}</a> : null}
                    {rep.email ? <a href={`mailto:${rep.email}`}>{rep.email}</a> : null}
                  </div>
                </div>
              ) : <div className={styles.empty}>No effective active rep profile is currently resolved for this company.</div>}
            </div>
          </section>

          <section className="card stack">
            <div><p className="eyebrow">Visibility</p><h2>Representative access</h2></div>
            <p className="muted">OGL remains authoritative for assignment. Company admins, approvers, actual managers and roles granted <code>company_rep_contacts_view</code> can receive the rep card. Ordinary buyers receive the company presentation without personal rep details.</p>
            <span className="badge badge-ok">Backend-enforced</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

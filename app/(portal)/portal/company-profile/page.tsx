import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getPortalCompanyPresentation } from "@/lib/graphql/company-presentation";
import styles from "@/components/company-personalisation-workspace.module.css";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function address(parts: Array<string | null>) {
  return parts.filter(Boolean).join(", ") || "—";
}

export default async function PortalCompanyProfilePage() {
  let presentation;
  try {
    presentation = await getPortalCompanyPresentation();
  } catch (error) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Company profile</p><h1>Company presentation unavailable</h1></div>
        <div className="error">{graphQLErrorMessage(error)}</div>
      </section>
    );
  }

  const rep = presentation.can_view_rep_contacts ? presentation.rep_contacts[0] ?? null : null;
  const bannerStyle = presentation.banner_url
    ? { backgroundImage: `linear-gradient(rgb(0 35 72 / 25%), rgb(0 35 72 / 25%)), url("${presentation.banner_url}")` }
    : undefined;

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{presentation.company_reference || "Company portal"}</p>
          <h1>{presentation.portal_title || presentation.company_name || "Company profile"}</h1>
          <p className="muted">Your company ordering information and authorised account contact.</p>
        </div>
      </header>

      {!presentation.enabled ? (
        <div className="notice">Your company has not enabled its personalised landing page yet. Core company details are shown below.</div>
      ) : null}

      <section className={`card ${styles.previewCard}`}>
        <div className={styles.banner} style={bannerStyle}>
          {presentation.logo_url ? <img className={styles.logo} src={presentation.logo_url} alt={`${presentation.company_name || "Company"} logo`} /> : null}
        </div>
        <div className={styles.previewBody}>
          <div>
            <p className="eyebrow">Welcome</p>
            <h2>{presentation.welcome_heading || `Welcome to ${presentation.company_name || "your company portal"}`}</h2>
            {presentation.welcome_text ? <p>{presentation.welcome_text}</p> : null}
            {presentation.company_description ? <p className="muted">{presentation.company_description}</p> : null}
          </div>

          <div className={styles.companyDetails}>
            <div className={styles.detail}><span>Company</span><strong>{presentation.company_name || "—"}</strong></div>
            <div className={styles.detail}><span>Reference</span><strong>{presentation.company_reference || "—"}</strong></div>
            <div className={styles.detail}><span>Telephone</span><strong>{presentation.contact_phone || "—"}</strong></div>
            <div className={styles.detail}><span>Email</span><strong>{presentation.contact_email || "—"}</strong></div>
            {presentation.procurement_email ? <div className={styles.detail}><span>Procurement</span><strong>{presentation.procurement_email}</strong></div> : null}
            <div className={`${styles.detail} ${styles.spanTwo}`}><span>Address</span><strong>{address([presentation.street, presentation.city, presentation.region, presentation.postcode, presentation.country_code])}</strong></div>
          </div>

          {rep ? (
            <div className={styles.repCard}>
              {rep.image_url ? <img className={styles.repPhoto} src={rep.image_url} alt={`${rep.name} profile`} /> : <div className={styles.repInitials} aria-hidden="true">{initials(rep.name)}</div>}
              <div className={styles.repBody}>
                <span className="muted small-text">Your account representative</span>
                <strong>{rep.name}</strong>
                <span>{rep.job_title || "Account Manager"}</span>
                {rep.profile_message ? <span className="muted">{rep.profile_message}</span> : null}
                {rep.phone ? <a href={`tel:${rep.phone}`}>{rep.phone}</a> : null}
                {rep.mobile ? <a href={`tel:${rep.mobile}`}>{rep.mobile}</a> : null}
                {rep.email ? <a href={`mailto:${rep.email}`}>{rep.email}</a> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

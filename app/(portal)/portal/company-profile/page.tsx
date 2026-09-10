import Link from "next/link";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getPortalCompanyPresentation } from "@/lib/graphql/company-presentation";
import styles from "@/components/portal/portal-company-profile.module.css";

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
        <div><p className="eyebrow">Company profile</p><h1>Company profile unavailable</h1></div>
        <div className="error">{graphQLErrorMessage(error)}</div>
      </section>
    );
  }

  const rep = presentation.can_view_rep_contacts ? presentation.rep_contacts[0] ?? null : null;
  const bannerStyle = presentation.banner_url
    ? { backgroundImage: `linear-gradient(rgb(0 35 72 / 18%), rgb(0 35 72 / 18%)), url("${presentation.banner_url}")` }
    : undefined;

  return (
    <div className={styles.profile}>
      <Link className={styles.backLink} href="/portal"><span aria-hidden="true">←</span> Company overview</Link>

      <header className={styles.header}>
        <div>
          <span className={styles.reference}>{presentation.company_reference || "Company profile"}</span>
          <h1>{presentation.portal_title || presentation.company_name || "Your company"}</h1>
          <p>Your company information and Chelmsford Safety Supplies account contact.</p>
        </div>
      </header>

      {!presentation.enabled ? (
        <div className={styles.notice}>Your personalised company page is not enabled yet. Your core company details are still available below.</div>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.primary}>
          <div className={styles.banner} style={bannerStyle}>
            {presentation.logo_url ? (
              <div className={styles.logoWrap}>
                <img className={styles.logo} src={presentation.logo_url} alt={`${presentation.company_name || "Company"} logo`} />
              </div>
            ) : null}
          </div>

          <div className={styles.primaryBody}>
            <div className={styles.welcome}>
              <span className="eyebrow">Welcome</span>
              <h2>{presentation.welcome_heading || `Welcome to ${presentation.company_name || "your company account"}`}</h2>
              {presentation.welcome_text ? <p>{presentation.welcome_text}</p> : null}
              {presentation.company_description ? <p className={styles.description}>{presentation.company_description}</p> : null}
            </div>

            <section className={styles.detailSection} aria-labelledby="company-details-heading">
              <h3 id="company-details-heading">Company details</h3>
              <div className={styles.details}>
                <div className={styles.detail}><span>Company</span><strong>{presentation.company_name || "—"}</strong></div>
                <div className={styles.detail}><span>Reference</span><strong>{presentation.company_reference || "—"}</strong></div>
                <div className={styles.detail}>
                  <span>Telephone</span>
                  {presentation.contact_phone ? <a href={`tel:${presentation.contact_phone}`}>{presentation.contact_phone}</a> : <strong>—</strong>}
                </div>
                <div className={styles.detail}>
                  <span>Email</span>
                  {presentation.contact_email ? <a href={`mailto:${presentation.contact_email}`}>{presentation.contact_email}</a> : <strong>—</strong>}
                </div>
                {presentation.procurement_email ? (
                  <div className={styles.detail}><span>Procurement</span><a href={`mailto:${presentation.procurement_email}`}>{presentation.procurement_email}</a></div>
                ) : null}
                <div className={`${styles.detail} ${styles.spanTwo}`}>
                  <span>Address</span>
                  <strong>{address([presentation.street, presentation.city, presentation.region, presentation.postcode, presentation.country_code])}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>

        <aside className={styles.sideColumn}>
          {rep ? (
            <section className={`${styles.sideCard} ${styles.repCard}`} aria-labelledby="account-manager-heading">
              <h2 id="account-manager-heading">Your account manager</h2>
              <div className={styles.repIdentity}>
                {rep.image_url ? <img className={styles.repPhoto} src={rep.image_url} alt={`${rep.name} profile`} /> : <div className={styles.repInitials} aria-hidden="true">{initials(rep.name)}</div>}
                <div className={styles.repIdentityText}>
                  <small>Chelmsford Safety Supplies</small>
                  <strong>{rep.name}</strong>
                  <span>{rep.job_title || "Account Manager"}</span>
                </div>
              </div>
              {rep.profile_message ? <p className={styles.repMessage}>{rep.profile_message}</p> : null}
              {(rep.phone || rep.mobile || rep.email) ? (
                <div className={styles.repContacts}>
                  {rep.phone ? <a href={`tel:${rep.phone}`}>Office · {rep.phone}</a> : null}
                  {rep.mobile ? <a href={`tel:${rep.mobile}`}>Mobile · {rep.mobile}</a> : null}
                  {rep.email ? <a href={`mailto:${rep.email}`}>{rep.email}</a> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.sideCard}>
            <p className="eyebrow">Account support</p>
            <h2>Need something changed?</h2>
            <p className="muted">Contact your account manager or Chelmsford Safety Supplies if your company details need updating.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

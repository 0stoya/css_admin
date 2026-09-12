import Link from "next/link";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getAdminOglRepProfiles } from "@/lib/graphql/company-presentation";
import { clearOglRepPhotoAction, saveOglRepProfileAction, uploadOglRepPhotoAction } from "./actions";
import styles from "@/components/rep-profile-workspace.module.css";
import polish from "@/components/rep-profile-final-polish.module.css";

function displayName(profile: Awaited<ReturnType<typeof getAdminOglRepProfiles>>[number]) {
  return `${profile.firstname ?? ""} ${profile.lastname ?? ""}`.trim() || profile.username || `Admin #${profile.admin_user_id}`;
}

function initials(profile: Awaited<ReturnType<typeof getAdminOglRepProfiles>>[number]) {
  return displayName(profile).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function OglRepProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  let profiles;
  try {
    profiles = await getAdminOglRepProfiles();
  } catch (error) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Backend request failed</p><h1>Representative profiles unavailable</h1></div>
        <div className="error">{graphQLErrorMessage(error)}</div>
      </section>
    );
  }

  return (
    <div className={`${styles.workspace} ${polish.workspace}`}>
      <header className="page-header">
        <div>
          <p className="eyebrow">OGL sales representatives</p>
          <h1>Representative profiles</h1>
          <p className="muted">Give each mapped OGL rep code one reusable contact card. Assignment stays controlled by the existing OGL mapping and company override flow.</p>
        </div>
        <Link className="button button-secondary button-link" href="/ogl?view=mappings">Manage rep mappings</Link>
      </header>

      {query.notice ? <div className="notice" role="status">{query.notice}</div> : null}
      {query.error ? <div className="error" role="alert">{query.error}</div> : null}

      <div className={`${styles.headerRow} ${polish.headerRow}`}>
        <div><h2>Rep cards</h2><p className="muted">Profile data is presentation-only and never changes which Magento administrator a rep code maps to.</p></div>
        <span className="badge badge-neutral">{profiles.length} mapped rep{profiles.length === 1 ? "" : "s"}</span>
      </div>

      {profiles.length ? (
        <div className={`${styles.cardGrid} ${polish.cardGrid}`}>
          {profiles.map((profile) => (
            <article className={`card ${styles.repCard} ${polish.repCard}`} key={profile.rep_code}>
              <div className={`${styles.repHeader} ${polish.repHeader}`}>
                {profile.photo_url ? <img className={styles.photo} src={profile.photo_url} alt={`${displayName(profile)} profile`} /> : <div className={styles.initials} aria-hidden="true">{initials(profile)}</div>}
                <div className={styles.identity}>
                  <strong>{displayName(profile)}</strong>
                  <span>{profile.mapped_email || "No Magento admin email"}</span>
                  <span>Admin #{profile.admin_user_id}</span>
                </div>
                <span className={`badge ${profile.admin_active && profile.profile_active ? "badge-ok" : "badge-restricted"} ${styles.code}`}>
                  {profile.rep_code}
                </span>
              </div>

              <div className={`${styles.metaStrip} ${polish.metaStrip}`}>
                <span className="badge badge-neutral">{profile.affected_company_count} compan{profile.affected_company_count === 1 ? "y" : "ies"}</span>
                <span className={`badge ${profile.admin_active ? "badge-ok" : "badge-restricted"}`}>Admin {profile.admin_active ? "active" : "inactive"}</span>
                <span className={`badge ${profile.profile_active ? "badge-ok" : "badge-neutral"}`}>Card {profile.profile_active ? "visible" : "hidden"}</span>
              </div>

              <form action={saveOglRepProfileAction} className={`${styles.profileForm} ${polish.profileForm}`}>
                <input type="hidden" name="repCode" value={profile.rep_code} />
                <label className={`${styles.toggleRow} ${polish.toggleRow}`}>
                  <span className={styles.toggleText}><strong>Show representative card</strong><small className="muted">Inactive profiles are suppressed from company-user GraphQL.</small></span>
                  <input name="profileActive" type="checkbox" defaultChecked={profile.profile_active} aria-label={`Show ${profile.rep_code} representative card`} />
                </label>
                <div className="field">
                  <label htmlFor={`job-${profile.rep_code}`}>Job title</label>
                  <input id={`job-${profile.rep_code}`} name="jobTitle" maxLength={128} defaultValue={profile.job_title ?? ""} placeholder="Account Manager" />
                </div>
                <div className="field">
                  <label htmlFor={`email-${profile.rep_code}`}>Display email</label>
                  <input id={`email-${profile.rep_code}`} name="displayEmail" type="email" maxLength={255} defaultValue={profile.display_email ?? ""} placeholder={profile.mapped_email ?? ""} />
                </div>
                <div className="field">
                  <label htmlFor={`phone-${profile.rep_code}`}>Telephone</label>
                  <input id={`phone-${profile.rep_code}`} name="phone" maxLength={64} defaultValue={profile.phone ?? ""} />
                </div>
                <div className="field">
                  <label htmlFor={`mobile-${profile.rep_code}`}>Mobile</label>
                  <input id={`mobile-${profile.rep_code}`} name="mobile" maxLength={64} defaultValue={profile.mobile ?? ""} />
                </div>
                <div className={`field ${styles.spanTwo}`}>
                  <label htmlFor={`message-${profile.rep_code}`}>Profile message</label>
                  <textarea id={`message-${profile.rep_code}`} name="profileMessage" rows={3} maxLength={2000} defaultValue={profile.profile_message ?? ""} placeholder="Your dedicated Chelmsford Safety Supplies account manager." />
                </div>
                <div className={styles.spanTwo}>
                  <button className="button" type="submit">Save {profile.rep_code} profile</button>
                </div>
              </form>

              <div className={`${styles.mediaActions} ${polish.mediaActions}`}>
                <form action={uploadOglRepPhotoAction}>
                  <input type="hidden" name="repCode" value={profile.rep_code} />
                  <input className={`${styles.fileInput} ${polish.fileInput}`} name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
                  <button className="button button-secondary" type="submit">Upload photo</button>
                </form>
                {profile.photo_url ? (
                  <form action={clearOglRepPhotoAction}>
                    <input type="hidden" name="repCode" value={profile.rep_code} />
                    <button className="button button-secondary" type="submit">Remove photo</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <strong>No mapped OGL representatives yet</strong>
          <p className="muted">Create a rep-code mapping first, then return here to add presentation details.</p>
          <Link className="button button-secondary button-link" href="/ogl?view=mappings">Open rep mappings</Link>
        </div>
      )}
    </div>
  );
}

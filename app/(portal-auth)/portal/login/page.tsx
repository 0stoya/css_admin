import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyLoginForm } from "@/components/company-login-form";
import styles from "@/components/company-login-page.module.css";
import { getAdminToken, getCompanyToken } from "@/lib/session";

export default async function CompanyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  if (await getCompanyToken()) {
    redirect("/portal");
  }
  if (await getAdminToken()) {
    redirect("/companies");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brandPanel}>
          <Image
            className={styles.logo}
            src="/css-logo.png"
            alt="Chelmsford Safety Supplies"
            width={2222}
            height={514}
            sizes="260px"
            priority
          />
          <div className={styles.brandCopy}>
            <span className={styles.productLabel}>Company Portal</span>
            <h1>Welcome to your company account</h1>
            <p>Manage the company services and controls your Fluid permissions allow, using your normal customer email address.</p>
          </div>
          <div className={styles.boundaryNote}>
            <strong>Company users</strong>
            <span>This sign-in uses a Magento customer account, not a Magento administrator account.</span>
          </div>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formHeading}>
            <p className="eyebrow">Company access</p>
            <h2>Sign in</h2>
            <p>Use the email address and password for your customer account.</p>
          </div>

          {reason === "expired" ? (
            <div className={styles.error} role="status">
              Your company session expired. Sign in again to continue.
            </div>
          ) : null}

          <CompanyLoginForm />

          <div className={styles.staffLink}>
            <span>Chelmsford Safety Supplies staff?</span>
            <Link href="/login">Administration sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

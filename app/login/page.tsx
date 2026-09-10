import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import styles from "@/components/login-page.module.css";
import { getAdminToken, getCompanyToken } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  if (await getAdminToken()) {
    redirect("/companies");
  }
  if (await getCompanyToken()) {
    redirect("/portal");
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
            <span className={styles.productLabel}>CSS Commerce</span>
            <h1>Welcome to your account</h1>
            <p>Sign in to manage your account, company services and the controls available to you.</p>
          </div>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formHeading}>
            <p className="eyebrow">Account access</p>
            <h2>Sign in</h2>
            <p>Use your email address or username and password.</p>
          </div>

          {reason === "expired" ? (
            <div className={styles.error} role="status">
              Your session expired. Sign in again to continue.
            </div>
          ) : null}

          <LoginForm />
        </div>
      </section>
    </main>
  );
}

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
    <main className="auth-wrap">
      <section className="auth-card">
        <div className={`auth-brand ${styles.brand}`}>
          <Image
            className="auth-logo"
            src="/css-logo.png"
            alt="CSS Commerce"
            width={2222}
            height={514}
            sizes="280px"
            priority
          />
          <span className="auth-product">Management portal</span>
        </div>

        <div className={`auth-heading ${styles.heading}`}>
          <h1>Sign in</h1>
        </div>

        {reason === "expired" ? (
          <div className="error" role="status">
            Your session expired. Sign in again to continue.
          </div>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
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
        <p className="eyebrow">Fluid / CSS Commerce</p>
        <h1>Management sign in</h1>
        <p className="muted">
          Staff use Magento administrator credentials. Company users use their Magento customer email and password; Fluid permissions decide which company-management features are available.
        </p>
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

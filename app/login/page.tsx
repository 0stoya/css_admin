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
        <p className="eyebrow">CSS Commerce</p>
        <h1>Sign in</h1>
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

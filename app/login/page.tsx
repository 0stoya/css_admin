import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAdminToken } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  if (await getAdminToken()) {
    redirect("/companies");
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="eyebrow">Fluid / CSS Commerce</p>
        <h1>Admin sign in</h1>
        <p className="muted">Use your Magento admin credentials. The resulting admin token is stored only in an HttpOnly session cookie.</p>
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

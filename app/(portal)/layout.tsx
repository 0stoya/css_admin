import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCompanyPortalAdministration } from "@/lib/graphql/company-portal";
import { getCompanyToken } from "@/lib/session";

export default async function CompanyPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getCompanyToken())) {
    redirect("/login");
  }

  let capabilities = null;
  try {
    capabilities = await getCompanyPortalAdministration();
  } catch {
    // Company selection and capability errors are rendered by the requested page.
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/portal" className="brand">CSS Company Portal</Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link href="/portal">Company</Link>
          {capabilities?.can_manage_catalog_visibility ? <Link href="/portal/catalog">Catalogue</Link> : null}
          {capabilities?.can_view_purchase_controls ? <Link href="/portal/purchase-controls">Purchase controls</Link> : null}
          <form action="/api/auth/logout" method="post">
            <button className="button button-secondary" type="submit">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

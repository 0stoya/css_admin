import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCompanyToken } from "@/lib/session";

export default async function CompanyPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getCompanyToken())) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/portal" className="brand">CSS Company Portal</Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link href="/portal">Company management</Link>
          <form action="/api/auth/logout" method="post">
            <button className="button button-secondary" type="submit">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

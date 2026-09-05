import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminToken } from "@/lib/session";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getAdminToken())) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/companies" className="brand">CSS Admin</Link>
        <nav className="nav" aria-label="Primary navigation">
          <Link href="/companies">Companies</Link>
          <Link href="/bulk-import">Bulk import</Link>
          <Link href="/ogl">OGL</Link>
          <form action="/api/auth/logout" method="post">
            <button className="button button-secondary" type="submit">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { getAdminToken } from "@/lib/session";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getAdminToken())) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <AppHeader
        homeHref="/companies"
        productLabel="Admin"
        navigation={[
          { href: "/companies", label: "Companies" },
          { href: "/bulk-import", label: "Bulk import" },
          { href: "/ogl", label: "OGL" },
        ]}
      />
      <main className="content">{children}</main>
    </div>
  );
}

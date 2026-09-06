import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader, type NavigationItem } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { getAdminToken } from "@/lib/session";

const navigation: NavigationItem[] = [
  { href: "/companies", label: "Companies" },
  { href: "/bulk-import", label: "Bulk import" },
  { href: "/ogl", label: "OGL" },
];

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getAdminToken())) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <AppHeader homeHref="/companies" productLabel="Admin" navigation={navigation} />
      <div className="app-workspace">
        <AppSidebar productLabel="Admin" navigation={navigation} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

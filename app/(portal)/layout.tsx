import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader, type NavigationItem } from "@/components/app-header";
import { AppHeaderContextProvider } from "@/components/app-header-context";
import { AppSidebar } from "@/components/app-sidebar";
import { getCompanyPortalAdministration } from "@/lib/graphql/company-portal";
import { getPortalEmployeeConfiguration } from "@/lib/graphql/company-portal-employees";
import { getCompanyToken } from "@/lib/session";

export default async function CompanyPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getCompanyToken())) {
    redirect("/login");
  }

  const [administrationResult, employeeResult] = await Promise.allSettled([
    getCompanyPortalAdministration(),
    getPortalEmployeeConfiguration(),
  ]);
  const capabilities = administrationResult.status === "fulfilled" ? administrationResult.value : null;
  // Employee ACL is independent of Users/Roles administration ACL, so probe the
  // employee read contract directly rather than hiding the route when css_company_admin is unavailable.
  const canViewEmployees = employeeResult.status === "fulfilled";

  const navigation: NavigationItem[] = [
    { href: "/portal", label: "Company", exact: true },
    ...(canViewEmployees ? [{ href: "/portal/employees", label: "Employees" }] : []),
    ...(capabilities?.can_manage_catalog_visibility ? [{ href: "/portal/catalog", label: "Catalogue" }] : []),
    ...(capabilities?.can_view_purchase_controls ? [{ href: "/portal/purchase-controls", label: "Purchase controls" }] : []),
  ];

  return (
    <AppHeaderContextProvider>
      <div className="shell">
        <AppHeader homeHref="/portal" productLabel="Company Portal" navigation={navigation} />
        <div className="app-workspace">
          <AppSidebar productLabel="Company Portal" navigation={navigation} />
          <main className="content">{children}</main>
        </div>
      </div>
    </AppHeaderContextProvider>
  );
}

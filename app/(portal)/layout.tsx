import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PortalHeader } from "@/components/portal/portal-header";
import {
  PortalSidebar,
  type PortalNavigationItem,
} from "@/components/portal/portal-sidebar";
import styles from "@/components/portal/portal-shell.module.css";
import { GraphQLRequestError } from "@/lib/graphql/client";
import { getCompanyPortalAdministration } from "@/lib/graphql/company-portal";
import { getPortalEmployeeConfiguration } from "@/lib/graphql/company-portal-employees";
import { getCompanyToken } from "@/lib/session";

export default async function CompanyPortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getCompanyToken())) {
    redirect("/portal/login");
  }

  const [administrationResult, employeeResult] = await Promise.allSettled([
    getCompanyPortalAdministration(),
    getPortalEmployeeConfiguration(),
  ]);

  const sessionExpired = [administrationResult, employeeResult].some(
    (result) => result.status === "rejected"
      && result.reason instanceof GraphQLRequestError
      && result.reason.status === 401,
  );
  if (sessionExpired) {
    redirect("/api/auth/session-expired?mode=company");
  }

  const capabilities = administrationResult.status === "fulfilled" ? administrationResult.value : null;
  // Employee ACL is independent of Users/Roles administration ACL, so probe the
  // employee read contract directly rather than hiding the route when css_company_admin is unavailable.
  const canViewEmployees = employeeResult.status === "fulfilled";

  const navigation: PortalNavigationItem[] = [
    { href: "/portal", label: "Company", exact: true },
    { href: "/portal/company-profile", label: "Company profile" },
    ...(canViewEmployees ? [{ href: "/portal/employees", label: "Employees" }] : []),
    ...(capabilities?.can_manage_catalog_visibility ? [{ href: "/portal/catalog", label: "Catalogue" }] : []),
    ...(capabilities?.can_view_purchase_controls ? [{ href: "/portal/purchase-controls", label: "Purchase controls" }] : []),
  ];

  return (
    <div className={styles.shell}>
      <PortalHeader />
      <div className={styles.workspace}>
        <PortalSidebar navigation={navigation} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

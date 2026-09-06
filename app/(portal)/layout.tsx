import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader, type NavigationItem } from "@/components/app-header";
import { AppHeaderContextProvider } from "@/components/app-header-context";
import { AppSidebar } from "@/components/app-sidebar";
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

  const navigation: NavigationItem[] = [
    { href: "/portal", label: "Company", exact: true },
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

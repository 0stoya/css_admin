import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader, type NavigationItem } from "@/components/app-header";
import { AppHeaderContextProvider } from "@/components/app-header-context";
import {
  AppSidebar,
  type CompanySidebarNavigationItem,
  type SidebarSectionNavigation,
} from "@/components/app-sidebar";
import { getAdminToken } from "@/lib/session";

const navigation: NavigationItem[] = [
  { href: "/companies", label: "Companies" },
  { href: "/bulk-import", label: "Bulk import" },
  { href: "/ogl", label: "OGL" },
];

const companyNavigation: CompanySidebarNavigationItem[] = [
  { segment: "", label: "Overview", exact: true },
  { segment: "management", label: "Users & roles" },
  { segment: "catalog", label: "Catalogue policy" },
  { segment: "purchase-controls", label: "Purchase controls" },
  { segment: "payment", label: "Payment configuration" },
  { segment: "credit", label: "Company credit" },
  { segment: "credit-orders", label: "Credit orders" },
  { segment: "pricing", label: "Pricing" },
  { segment: "import-export", label: "Import / export" },
  { segment: "settings", label: "Company settings" },
];

const sectionNavigation: SidebarSectionNavigation[] = [
  {
    parentHref: "/bulk-import",
    heading: "Bulk import tools",
    items: [
      { href: "/bulk-import#company-structure", label: "Company structure" },
      { href: "/bulk-import#company-users", label: "Company users" },
      { href: "/bulk-import#roles-permissions", label: "Roles & permissions" },
      { href: "/bulk-import#role-products", label: "Role product restrictions" },
      { href: "/bulk-import#company-products", label: "Company product restrictions" },
    ],
  },
  {
    parentHref: "/ogl",
    heading: "OGL administration",
    items: [
      { href: "/ogl#registry", label: "Company registry" },
      { href: "/ogl#rep-mappings", label: "Rep-code mappings" },
    ],
  },
];

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getAdminToken())) {
    redirect("/login");
  }

  return (
    <AppHeaderContextProvider>
      <div className="shell">
        <AppHeader homeHref="/companies" productLabel="Admin" navigation={navigation} />
        <div className="app-workspace">
          <AppSidebar
            productLabel="Admin"
            navigation={navigation}
            companyNavigation={companyNavigation}
            sectionNavigation={sectionNavigation}
          />
          <main className="content">{children}</main>
        </div>
      </div>
    </AppHeaderContextProvider>
  );
}

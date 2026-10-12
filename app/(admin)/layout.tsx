import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { PwaInstallPromptProvider } from "@/components/pwa-install-control";
import type { ReactNode } from "react";
import { AdminContextHelp } from "@/components/admin-context-help";
import { AppHeader, type NavigationItem } from "@/components/app-header";
import { AppHeaderContextProvider } from "@/components/app-header-context";
import {
  AppSidebar,
  type CompanySidebarNavigationItem,
  type SidebarSectionNavigation,
} from "@/components/app-sidebar";
import { getAdminToken } from "@/lib/session";

export const metadata: Metadata = {
  manifest: "/pwa/admin.webmanifest",
  appleWebApp: { capable: true, title: "CSS Admin", statusBarStyle: "default" },
  icons: { apple: [{ url: "/pwa/icon/180", sizes: "180x180", type: "image/png" }] },
};

const navigation: NavigationItem[] = [
  { href: "/companies", label: "Companies" },
  { href: "/jobs", label: "Export jobs" },
  { href: "/bulk-import", label: "Bulk import" },
  { href: "/ogl", label: "OGL" },
  { href: "/crm", label: "CRM", activePaths: ["/migrations", "/help"] },
  { href: "/settings", label: "Settings" },
];

const companyNavigation: CompanySidebarNavigationItem[] = [
  { segment: "", label: "Overview", exact: true },
  { segment: "finance", label: "Finance" },
  { segment: "management", label: "Users & roles" },
  { segment: "employees", label: "Employees" },
  { segment: "catalog", label: "Catalogue policy" },
  { segment: "purchase-controls", label: "Purchase controls" },
  { segment: "payment", label: "Payment configuration" },
  { segment: "credit", label: "Company credit" },
  { segment: "credit-orders", label: "Credit orders" },
  { segment: "pricing", label: "Pricing" },
  { segment: "import-export", label: "Import / export" },
  { segment: "personalisation", label: "Personalisation" },
  { segment: "settings", label: "Company settings" },
];

const sectionNavigation: SidebarSectionNavigation[] = [
  {
    parentHref: "/bulk-import",
    heading: "Bulk import tools",
    items: [
      { href: "/bulk-import", label: "Company structure" },
      { href: "/bulk-import?view=users", label: "Users" },
      { href: "/bulk-import?view=roles", label: "Roles & permissions" },
      { href: "/bulk-import?view=role-products", label: "Role products" },
      { href: "/bulk-import?view=company-products", label: "Company products" },
      { href: "/bulk-import?view=purchase-controls", label: "Purchase controls" },
      { href: "/bulk-import?view=company-descriptions", label: "Company descriptions" },
    ],
  },
  {
    parentHref: "/ogl",
    heading: "OGL tools",
    items: [
      { href: "/ogl", label: "Companies" },
      { href: "/ogl?view=mappings", label: "Rep mappings" },
      { href: "/ogl/rep-profiles", label: "Rep profiles" },
    ],
  },
  {
    parentHref: "/crm",
    heading: "CRM tools",
    items: [
      { href: "/crm", label: "Overview" },
      { href: "/migrations", label: "Migrations", matchDescendants: true },
      { href: "/help", label: "Help & guides", matchDescendants: true },
    ],
  },
];

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getAdminToken())) {
    redirect("/login");
  }

  return (
    <PwaInstallPromptProvider>
      <AppHeaderContextProvider>
      <div className="shell admin-shell">
        <a className="admin-skip-link" href="#admin-main-content">Skip to main content</a>
        <PwaServiceWorker />
        <AppHeader homeHref="/companies" productLabel="Admin" navigation={navigation} />
        <div className="app-workspace">
          <AppSidebar
            productLabel="Admin"
            navigation={navigation}
            companyNavigation={companyNavigation}
            sectionNavigation={sectionNavigation}
          />
          <main className="content" id="admin-main-content" tabIndex={-1}>{children}</main>
          <AdminContextHelp />
        </div>
      </div>
      </AppHeaderContextProvider>
    </PwaInstallPromptProvider>
  );
}

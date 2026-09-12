"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Contact,
  CreditCard,
  Database,
  LayoutDashboard,
  Network,
  Package,
  Palette,
  Settings,
  Shield,
  SlidersHorizontal,
  Upload,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavigationItem } from "@/components/app-header";
import { useAppHeaderContext } from "@/components/app-header-context";

export type CompanySidebarNavigationItem = {
  segment: string;
  label: string;
  exact?: boolean;
};

export type SidebarSectionNavigation = {
  parentHref: string;
  heading: string;
  items: Array<{
    href: string;
    label: string;
  }>;
};

const adminTopLevelIcons: Record<string, LucideIcon> = {
  "/companies": Building2,
  "/bulk-import": Upload,
  "/ogl": Database,
};

const adminCompanyIcons: Record<string, LucideIcon> = {
  "": LayoutDashboard,
  finance: Activity,
  management: Users,
  employees: UserRound,
  catalog: BookOpen,
  "purchase-controls": SlidersHorizontal,
  payment: CreditCard,
  credit: Wallet,
  "credit-orders": ClipboardList,
  pricing: CircleDollarSign,
  "import-export": ArrowLeftRight,
  personalisation: Palette,
  settings: Settings,
};

const adminSectionIcons: Record<string, LucideIcon> = {
  "/bulk-import": Network,
  "/bulk-import?view=users": Users,
  "/bulk-import?view=roles": Shield,
  "/bulk-import?view=role-products": Package,
  "/bulk-import?view=company-products": Package,
  "/ogl": Building2,
  "/ogl?view=mappings": Network,
  "/ogl/rep-profiles": Contact,
};

function hrefPath(href: string) {
  return href.split("#", 1)[0].split("?", 1)[0] || href;
}

function isActive(pathname: string, item: NavigationItem) {
  const path = hrefPath(item.href);
  return item.exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
}

function isChildActive(pathname: string, href: string, exact = false) {
  const path = hrefPath(href);
  return exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
}

function isSectionChildActive(pathname: string, currentQuery: string, href: string) {
  const [withoutHash] = href.split("#", 1);
  const [path, query = ""] = withoutHash.split("?", 2);
  if (pathname !== path) return false;

  const current = new URLSearchParams(currentQuery);
  const expected = new URLSearchParams(query);
  if (![...expected.keys()].length) {
    return !current.get("view");
  }

  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }

  return true;
}

function SidebarIcon({ icon: Icon }: { icon: LucideIcon | undefined }) {
  return Icon ? <Icon className="sidebar-nav-icon" size={16} strokeWidth={1.9} aria-hidden="true" /> : null;
}

export function AppSidebar({
  productLabel,
  navigation,
  companyNavigation = [],
  sectionNavigation = [],
}: {
  productLabel: string;
  navigation: NavigationItem[];
  companyNavigation?: CompanySidebarNavigationItem[];
  sectionNavigation?: SidebarSectionNavigation[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const { company } = useAppHeaderContext();
  const companyBase = company ? `/companies/${company.companyId}` : null;
  const companySectionVisible = Boolean(
    companyBase
    && pathname.startsWith(companyBase)
    && companyNavigation.length,
  );
  const showAdminIcons = productLabel === "Admin";

  return (
    <aside className={`app-sidebar${showAdminIcons ? " app-sidebar-admin-icons" : ""}`} aria-label={`${productLabel} navigation`}>
      <div className="app-sidebar-inner">
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item);
            const staticSection = sectionNavigation.find((section) => section.parentHref === item.href);
            const showCompanySection = item.href === "/companies" && companySectionVisible;
            const showStaticSection = Boolean(staticSection && active);
            const staticChildCurrent = Boolean(
              staticSection?.items.some((child) => isSectionChildActive(pathname, currentQuery, child.href)),
            );
            const topLevelCurrent = pathname === hrefPath(item.href) && !staticChildCurrent;

            return (
              <div className="sidebar-group" key={item.href}>
                <Link
                  className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
                  href={item.href}
                  aria-current={topLevelCurrent ? "page" : undefined}
                  aria-expanded={showCompanySection || showStaticSection ? true : undefined}
                >
                  <span className="sidebar-link-marker" aria-hidden="true" />
                  {showAdminIcons ? <SidebarIcon icon={adminTopLevelIcons[item.href]} /> : null}
                  <span>{item.label}</span>
                </Link>

                {showCompanySection && companyBase ? (
                  <div className="sidebar-subnav sidebar-company-subnav">
                    <span className="sidebar-subnav-heading">Company management</span>
                    {companyNavigation.map((child) => {
                      const href = child.segment ? `${companyBase}/${child.segment}` : companyBase;
                      const childActive = isChildActive(pathname, href, child.exact);
                      return (
                        <Link
                          className={`sidebar-sublink${childActive ? " sidebar-sublink-active" : ""}`}
                          href={href}
                          aria-current={childActive ? "page" : undefined}
                          key={child.segment || "overview"}
                        >
                          <span className="sidebar-sublink-marker" aria-hidden="true" />
                          {showAdminIcons ? <SidebarIcon icon={adminCompanyIcons[child.segment]} /> : null}
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                {showStaticSection && staticSection ? (
                  <div className="sidebar-subnav">
                    <span className="sidebar-subnav-heading">{staticSection.heading}</span>
                    {staticSection.items.map((child) => {
                      const childActive = isSectionChildActive(pathname, currentQuery, child.href);
                      return (
                        <Link
                          className={`sidebar-sublink${childActive ? " sidebar-sublink-active" : ""}`}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          key={child.href}
                        >
                          <span className="sidebar-sublink-marker" aria-hidden="true" />
                          {showAdminIcons ? <SidebarIcon icon={adminSectionIcons[child.href]} /> : null}
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

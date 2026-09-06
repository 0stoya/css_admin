"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

function hrefPath(href: string) {
  return href.split("#", 1)[0] || href;
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
  const { company } = useAppHeaderContext();
  const companyBase = company ? `/companies/${company.companyId}` : null;
  const companySectionVisible = Boolean(
    companyBase
    && pathname.startsWith(companyBase)
    && companyNavigation.length,
  );

  return (
    <aside className="app-sidebar" aria-label={`${productLabel} navigation`}>
      <div className="app-sidebar-inner">
        <div className="sidebar-heading">
          <span className="sidebar-kicker">CSS Commerce</span>
          <strong>{productLabel}</strong>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item);
            const staticSection = sectionNavigation.find((section) => section.parentHref === item.href);
            const showCompanySection = item.href === "/companies" && companySectionVisible;
            const showStaticSection = Boolean(staticSection && active);
            const topLevelCurrent = pathname === hrefPath(item.href);

            return (
              <div className="sidebar-group" key={item.href}>
                <Link
                  className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
                  href={item.href}
                  aria-current={topLevelCurrent ? "page" : undefined}
                  aria-expanded={showCompanySection || showStaticSection ? true : undefined}
                >
                  <span className="sidebar-link-marker" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>

                {showCompanySection && company && companyBase ? (
                  <div className="sidebar-subnav sidebar-company-subnav">
                    <div className="sidebar-company-context" title={`${company.name} | ${company.reference || `Company ${company.companyId}`}`}>
                      <span className="sidebar-subnav-kicker">Current company</span>
                      <strong>{company.name}</strong>
                      <span className="sidebar-company-reference">{company.reference || `Company ${company.companyId}`}</span>
                    </div>
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
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                {showStaticSection && staticSection ? (
                  <div className="sidebar-subnav">
                    <span className="sidebar-subnav-heading">{staticSection.heading}</span>
                    {staticSection.items.map((child) => (
                      <Link className="sidebar-sublink" href={child.href} key={child.href}>
                        <span className="sidebar-sublink-marker" aria-hidden="true" />
                        <span>{child.label}</span>
                      </Link>
                    ))}
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

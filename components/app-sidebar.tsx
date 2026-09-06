"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/components/app-header";

function isActive(pathname: string, item: NavigationItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppSidebar({
  productLabel,
  navigation,
}: {
  productLabel: string;
  navigation: NavigationItem[];
}) {
  const pathname = usePathname();

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
            return (
              <Link
                className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                key={item.href}
              >
                <span className="sidebar-link-marker" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

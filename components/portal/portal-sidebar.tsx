"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "@/components/portal/portal-shell.module.css";

export type PortalNavigationItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function isActive(pathname: string, currentQuery: string, item: PortalNavigationItem) {
  const [withoutHash] = item.href.split("#", 1);
  const [path, query = ""] = withoutHash.split("?", 2);
  const pathMatches = item.exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;

  const expected = new URLSearchParams(query);
  if (![...expected.keys()].length) return true;

  const current = new URLSearchParams(currentQuery);
  for (const [key, value] of expected.entries()) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

export function PortalSidebar({ navigation }: { navigation: PortalNavigationItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();

  return (
    <aside className={styles.sidebar} aria-label="Company Portal navigation">
      <div className={styles.sidebarInner}>
        <p className={styles.sidebarHeading}>Your company</p>
        <nav className={styles.sidebarNav}>
          {navigation.map((item) => {
            const active = isActive(pathname, currentQuery, item);
            return (
              <Link
                className={`${styles.sidebarLink}${active ? ` ${styles.sidebarLinkActive}` : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                key={item.href}
              >
                <span className={styles.sidebarMarker} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

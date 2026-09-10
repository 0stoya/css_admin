"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/components/portal/portal-shell.module.css";

export type PortalNavigationItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function isActive(pathname: string, item: PortalNavigationItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function PortalSidebar({ navigation }: { navigation: PortalNavigationItem[] }) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} aria-label="Company Portal navigation">
      <div className={styles.sidebarInner}>
        <p className={styles.sidebarHeading}>Your company</p>
        <nav className={styles.sidebarNav}>
          {navigation.map((item) => {
            const active = isActive(pathname, item);
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

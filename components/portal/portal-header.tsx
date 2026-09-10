"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "@/components/portal/portal-shell.module.css";

export function PortalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/portal" className={styles.brand} aria-label="Chelmsford Safety Supplies Company Portal">
          <Image
            className={styles.brandLogo}
            src="/css-logo.png"
            alt="Chelmsford Safety Supplies"
            width={2222}
            height={514}
            sizes="(max-width: 700px) 145px, 175px"
            priority
          />
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandLabel}>Company Portal</span>
        </Link>

        <form className={styles.signoutForm} action="/api/auth/logout" method="post">
          <button className={styles.signoutButton} type="submit">Sign out</button>
        </form>
      </div>
    </header>
  );
}

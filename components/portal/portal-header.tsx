import { Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PortalHeaderCompanySwitcher } from "@/components/portal/portal-header-company-switcher";
import styles from "@/components/portal/portal-shell.module.css";
import { getStorefrontUrl } from "@/lib/config";
import type { CompanyPortalContext } from "@/lib/graphql/company-portal";

export function PortalHeader({
  context,
  portalTitle,
}: {
  context: CompanyPortalContext | null;
  portalTitle: string | null;
}) {
  const title = portalTitle?.trim() || "Company Portal";
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/portal" className={styles.brand} aria-label={`Chelmsford Safety Supplies ${title}`}>
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
          <span className={styles.brandLabel}>{title}</span>
        </Link>

        <div className={styles.headerActions}>
          {context ? (
            <PortalHeaderCompanySwitcher
              companies={context.companies}
              selectedCompanyId={context.selected_company_id}
            />
          ) : null}
          <a className={styles.appSwitchLink} href={`${getStorefrontUrl()}/api/auth/sso/start`}>
            <Store size={17} strokeWidth={2.1} aria-hidden="true" />
            <span>Shop</span>
          </a>
          <form className={styles.signoutForm} action="/api/auth/logout" method="post">
            <button className={styles.signoutButton} type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}

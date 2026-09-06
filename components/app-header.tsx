"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppHeaderContext } from "@/components/app-header-context";

export type NavigationItem = {
  href: string;
  label: string;
  exact?: boolean;
};

export function AppHeader({
  homeHref,
  productLabel,
  navigation,
}: {
  homeHref: string;
  productLabel: string;
  navigation: NavigationItem[];
}) {
  const pathname = usePathname();
  const { company } = useAppHeaderContext();
  const contextLabel = company
    ? `${company.name} | ${company.reference || `Company ${company.companyId}`}`
    : productLabel;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href={homeHref} className="brand-link" aria-label={`CSS Commerce — ${contextLabel}`}>
          <Image
            className="brand-logo"
            src="/css-logo.png"
            alt="CSS Commerce"
            width={2222}
            height={514}
            sizes="(max-width: 700px) 148px, 180px"
            priority
          />
          {company ? (
            <span className="brand-context brand-context-company" title={`Current company: ${contextLabel}`}>
              <span className="brand-company-name">{company.name}</span>
              <span className="brand-context-separator" aria-hidden="true">|</span>
              <span className="brand-company-reference">{company.reference || `Company ${company.companyId}`}</span>
            </span>
          ) : (
            <span className="brand-context">{productLabel}</span>
          )}
        </Link>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={`nav-link${active ? " nav-link-active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form className="signout-form" action="/api/auth/logout" method="post">
          <button className="button button-secondary button-compact" type="submit">Sign out</button>
        </form>
      </div>
    </header>
  );
}

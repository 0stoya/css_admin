"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href={homeHref} className="brand-link" aria-label={`CSS Commerce ${productLabel}`}>
          <Image
            className="brand-logo"
            src="/css-logo.png"
            alt="CSS Commerce"
            width={2222}
            height={514}
            sizes="(max-width: 700px) 148px, 180px"
            priority
          />
          <span className="brand-context">{productLabel}</span>
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

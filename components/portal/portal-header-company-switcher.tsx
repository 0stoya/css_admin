"use client";

import { useRef } from "react";
import { selectPortalCompanyAction } from "@/app/(portal)/portal/actions";
import type { CompanyPortalMembership } from "@/lib/graphql/company-portal";
import styles from "@/components/portal/portal-shell.module.css";

export function PortalHeaderCompanySwitcher({
  companies,
  selectedCompanyId,
  portalTitles,
}: {
  companies: CompanyPortalMembership[];
  selectedCompanyId: number | null;
  portalTitles: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (companies.length <= 1 || selectedCompanyId === null) return null;

  return (
    <form
      ref={formRef}
      className={styles.headerCompanySwitcher}
      action={selectPortalCompanyAction}
    >
      <label className={styles.headerCompanyLabel} htmlFor="portal-header-company">
        Company
      </label>
      <select
        id="portal-header-company"
        className={styles.headerCompanySelect}
        name="companyId"
        defaultValue={selectedCompanyId}
        aria-label="Switch company"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {companies.map((company) => {
          const destinationTitle = portalTitles[String(company.company_id)]?.trim();
          const destinationLabel = destinationTitle
            || company.name
            || "Company " + company.company_id;

          return (
            <option key={company.company_id} value={company.company_id}>
              {company.reference
                ? company.reference + " · " + destinationLabel
                : destinationLabel}
              {!company.active ? " — inactive" : ""}
            </option>
          );
        })}
      </select>
      <noscript>
        <button className={styles.headerCompanyFallbackButton} type="submit">
          Switch
        </button>
      </noscript>
    </form>
  );
}

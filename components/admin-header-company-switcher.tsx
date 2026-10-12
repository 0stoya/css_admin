"use client";

import { useRouter } from "next/navigation";
import type { CompanyHeaderSwitchOption } from "@/components/app-header-context";
import styles from "@/components/admin-header-company-switcher.module.css";

export function AdminHeaderCompanySwitcher({
  currentCompanyId,
  companies,
}: {
  currentCompanyId: number;
  companies: CompanyHeaderSwitchOption[];
}) {
  const router = useRouter();
  if (companies.length < 2 || !companies.some((company) => company.companyId === currentCompanyId)) {
    return null;
  }

  return (
    <div className={styles.switcher}>
      <label className={styles.label} htmlFor="admin-header-company-switch">
        Switch company
      </label>
      <select
        id="admin-header-company-switch"
        className={styles.select}
        aria-label="Switch company within structure"
        value={currentCompanyId}
        onChange={(event) => {
          const nextId = Number(event.currentTarget.value);
          if (
            Number.isSafeInteger(nextId) &&
            nextId !== currentCompanyId &&
            companies.some((company) => company.companyId === nextId)
          ) {
            // Always land on the overview: company-scoped editing permissions vary.
            router.push(`/companies/${nextId}`);
          }
        }}
      >
        {companies.map((company) => (
          <option key={company.companyId} value={company.companyId}>
            {company.reference || `Company ${company.companyId}`} · {company.name}
            {!company.status ? " — disabled" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

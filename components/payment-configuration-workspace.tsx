"use client";

import { useMemo, useState } from "react";
import { saveCompanyPaymentConfigurationAction } from "@/app/(admin)/companies/[id]/payment/actions";
import type { CompanyPaymentConfiguration, PaymentMethodOption } from "@/lib/graphql/payment-configuration";
import styles from "./payment-configuration-workspace.module.css";

type PaymentMode = "default" | "all" | "specific";

type Props = {
  companyId: number;
  configuration: CompanyPaymentConfiguration;
};

function initialMode(configuration: CompanyPaymentConfiguration): PaymentMode {
  if (!configuration.is_configured) return "default";
  return configuration.is_specific ? "specific" : "all";
}

function StrokeIcon({ kind }: { kind: PaymentMode }) {
  if (kind === "default") {
    return (
      <svg aria-hidden="true" className={styles.modeIcon} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  if (kind === "all") {
    return (
      <svg aria-hidden="true" className={styles.modeIcon} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={styles.modeIcon} fill="none" viewBox="0 0 24 24">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" />
    </svg>
  );
}

function methodMatches(method: PaymentMethodOption, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${method.label} ${method.code}`.toLowerCase().includes(normalized);
}

export function PaymentConfigurationWorkspace({ companyId, configuration }: Props) {
  const availableCodes = useMemo(
    () => new Set(configuration.available_methods.map((method) => method.code)),
    [configuration.available_methods],
  );
  const [mode, setMode] = useState<PaymentMode>(() => initialMode(configuration));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(configuration.allowed_methods.filter((code) => availableCodes.has(code))),
  );

  const visibleMethods = useMemo(
    () => configuration.available_methods.filter((method) => methodMatches(method, query)),
    [configuration.available_methods, query],
  );

  const modeOptions: Array<{
    value: PaymentMode;
    title: string;
    description: string;
    meta: string;
  }> = [
    {
      value: "default",
      title: "Platform default",
      description: "Use Fluid's normal payment configuration for this company.",
      meta: "No company-specific override",
    },
    {
      value: "all",
      title: "All available methods",
      description: "Enable company payment configuration without narrowing the available methods.",
      meta: `${configuration.available_methods.length} methods currently available`,
    },
    {
      value: "specific",
      title: "Specific methods",
      description: "Limit checkout to an explicit set of payment methods for this company.",
      meta: `${selected.size} selected`,
    },
  ];

  function toggleMethod(code: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const method of visibleMethods) next.add(method.code);
      return next;
    });
  }

  function clearVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const method of visibleMethods) next.delete(method.code);
      return next;
    });
  }

  const cannotSave = mode === "specific" && selected.size === 0;

  return (
    <form action={saveCompanyPaymentConfigurationAction} className={styles.workspace}>
      <input name="companyId" type="hidden" value={companyId} />
      {mode !== "specific"
        ? Array.from(selected).map((code) => (
            <input key={code} name="allowedMethods" type="hidden" value={code} />
          ))
        : null}

      <section className={styles.policyCard}>
        <div className={styles.cardHeading}>
          <div>
            <p className="eyebrow">Company policy</p>
            <h2>Choose payment behaviour</h2>
            <p className="muted">Select the level of company-specific payment control to apply at checkout.</p>
          </div>
          <span className={`badge ${mode === "default" ? "badge-neutral" : "badge-ok"}`}>
            {mode === "default" ? "Using platform default" : "Company override"}
          </span>
        </div>

        <div className={styles.modeGrid}>
          {modeOptions.map((option) => {
            const active = mode === option.value;
            return (
              <label className={`${styles.modeCard} ${active ? styles.modeCardActive : ""}`} key={option.value}>
                <input
                  checked={active}
                  name="mode"
                  onChange={() => setMode(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span className={styles.iconWrap}><StrokeIcon kind={option.value} /></span>
                <span className={styles.modeCopy}>
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                  <small>{option.meta}</small>
                </span>
                <span aria-hidden="true" className={styles.radioMark} />
              </label>
            );
          })}
        </div>
      </section>

      {mode === "specific" ? (
        <section className={styles.methodsCard}>
          <div className={styles.cardHeading}>
            <div>
              <p className="eyebrow">Specific methods</p>
              <h2>Allowed payment methods</h2>
              <p className="muted">Only checked methods will remain available to this company.</p>
            </div>
            <div className={styles.selectionCount}>
              <strong>{selected.size}</strong>
              <span>of {configuration.available_methods.length} selected</span>
            </div>
          </div>

          {configuration.available_methods.length ? (
            <>
              <div className={styles.methodToolbar}>
                <label className={styles.searchField}>
                  <span>Find a method</span>
                  <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search payment method or code"
                    type="search"
                    value={query}
                  />
                </label>
                <div className={styles.toolbarActions}>
                  <button className="button button-secondary button-compact" onClick={selectVisible} type="button">
                    Select visible
                  </button>
                  <button className="button button-secondary button-compact" onClick={clearVisible} type="button">
                    Clear visible
                  </button>
                </div>
              </div>

              <div className={styles.methodGrid}>
                {visibleMethods.map((method) => {
                  const checked = selected.has(method.code);
                  return (
                    <label className={`${styles.methodRow} ${checked ? styles.methodRowSelected : ""}`} key={method.code}>
                      <input
                        checked={checked}
                        name="allowedMethods"
                        onChange={() => toggleMethod(method.code)}
                        type="checkbox"
                        value={method.code}
                      />
                      <span className={styles.methodCopy}>
                        <strong>{method.label}</strong>
                        <code>{method.code}</code>
                      </span>
                      <span className={styles.methodState}>{checked ? "Allowed" : "Blocked"}</span>
                    </label>
                  );
                })}
              </div>

              {visibleMethods.length === 0 ? (
                <div className={styles.emptyState}>No payment methods match that search.</div>
              ) : null}
            </>
          ) : (
            <div className={styles.emptyState}>Fluid returned no payment methods that can be selected for this company.</div>
          )}
        </section>
      ) : null}

      <div className={styles.saveBar}>
        <div>
          <strong>{modeOptions.find((option) => option.value === mode)?.title}</strong>
          <span>
            {mode === "specific"
              ? `${selected.size} payment method${selected.size === 1 ? "" : "s"} will be allowed.`
              : mode === "all"
                ? "All currently available payment methods will remain available."
                : "Fluid's default payment configuration will apply."}
          </span>
        </div>
        <button className="button" disabled={cannotSave} type="submit">Save payment policy</button>
      </div>
    </form>
  );
}

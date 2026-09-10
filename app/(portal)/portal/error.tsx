"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "@/components/portal/portal-feedback.module.css";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stateRef = useRef<HTMLElement>(null);

  useEffect(() => {
    stateRef.current?.focus();
  }, [error]);

  return (
    <section ref={stateRef} className={styles.state} role="alert" tabIndex={-1}>
      <span className={styles.stateIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
      </span>
      <div className={styles.stateCopy}>
        <p className="eyebrow">Company Portal</p>
        <h1>We couldn’t load this page</h1>
        <p>Try the page again. If the problem continues, return to your company overview or sign out and sign back in.</p>
      </div>
      <div className={styles.actions}>
        <button className="button" type="button" onClick={reset}>Try again</button>
        <Link className="button button-secondary button-link" href="/portal">Company overview</Link>
      </div>
      {process.env.NODE_ENV !== "production" && error.message ? (
        <details className={styles.technical}>
          <summary>Technical details</summary>
          <code>{error.message}</code>
        </details>
      ) : null}
    </section>
  );
}

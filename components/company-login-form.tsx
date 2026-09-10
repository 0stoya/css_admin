"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/company-login-page.module.css";

function MailIcon() {
  return (
    <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function CompanyLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "company",
          login: form.get("email"),
          password: form.get("password"),
        }),
      });

      const body = (await response.json()) as { ok?: boolean; error?: string; destination?: string };

      if (!response.ok || !body.ok) {
        setError(body.error || "Sign in failed.");
        return;
      }

      router.replace(body.destination || "/portal");
      router.refresh();
    } catch {
      setError("Could not reach the company portal server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field} htmlFor="company-email">
        <span>Email address</span>
        <span className={styles.inputWrap}>
          <MailIcon />
          <input
            id="company-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </span>
      </label>

      <label className={styles.field} htmlFor="company-password">
        <span>Password</span>
        <span className={styles.inputWrap}>
          <LockIcon />
          <input id="company-password" name="password" type="password" autoComplete="current-password" required />
        </span>
      </label>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in to Company Portal"}</button>
    </form>
  );
}

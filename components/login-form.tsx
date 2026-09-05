"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AccountType = "staff" | "company";

export function LoginForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("staff");
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
          account_type: accountType,
          username: form.get("username"),
          password: form.get("password"),
        }),
      });

      const body = (await response.json()) as { ok?: boolean; error?: string; destination?: string };

      if (!response.ok || !body.ok) {
        setError(body.error || "Sign in failed.");
        return;
      }

      router.replace(body.destination || (accountType === "company" ? "/portal" : "/companies"));
      router.refresh();
    } catch {
      setError("Could not reach the management application server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <fieldset className="field">
        <legend>Sign in as</legend>
        <label>
          <input
            type="radio"
            name="accountType"
            value="staff"
            checked={accountType === "staff"}
            onChange={() => setAccountType("staff")}
          />{" "}
          Staff / Magento administrator
        </label>
        <label>
          <input
            type="radio"
            name="accountType"
            value="company"
            checked={accountType === "company"}
            onChange={() => setAccountType("company")}
          />{" "}
          Company user
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor="username">{accountType === "company" ? "Email" : "Username"}</label>
        <input
          id="username"
          name="username"
          type={accountType === "company" ? "email" : "text"}
          autoComplete="username"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="button" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

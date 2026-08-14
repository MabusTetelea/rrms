"use client";

import { useState, useTransition } from "react";
import { loginAction, quickLoginAction } from "@/app/auth-actions";
import type { Dict } from "@/lib/i18n";

export type QuickAccount = { email: string; label: string };

export function LoginForm({
  t,
  quickAccounts,
}: {
  t: Dict;
  quickAccounts: QuickAccount[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(run: () => Promise<{ ok: false; error: string } | void>) {
    startTransition(async () => {
      setError(null);
      // A successful sign-in redirects, so anything returned here is a failure.
      const result = await run();
      if (result && !result.ok) {
        setError(result.error === "throttled" ? t.login.throttled : t.login.invalid);
      }
    });
  }

  return (
    <div className="w-full max-w-sm">
      <form
        action={(formData) => handle(() => loginAction(formData))}
        className="grid gap-4"
      >
        <label className="block">
          <span className="eyebrow">{t.login.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className="input mt-1.5"
          />
        </label>

        <label className="block">
          <span className="eyebrow">{t.login.password}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input mt-1.5"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="border-l-2 border-brand bg-brand-soft px-3 py-2 text-sm text-brand"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[2px] bg-ink px-3.5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {pending ? t.login.signingIn : t.login.signIn}
        </button>
      </form>

      {quickAccounts.length > 0 ? (
        <div className="mt-8 border border-mid/40 bg-mid-soft/60 px-4 py-4">
          <p className="flex items-center gap-2">
            <span className="rounded-[2px] bg-mid px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] text-white uppercase">
              {t.login.betaTag}
            </span>
            <span className="text-sm font-medium">{t.login.quickTitle}</span>
          </p>
          <p className="mt-1.5 text-xs text-ink-soft">{t.login.quickHint}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={pending}
                onClick={() => handle(() => quickLoginAction(account.email))}
                className="rounded-[2px] border border-ink/25 bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-surface/60 disabled:opacity-50"
              >
                <span className="block font-medium">{account.label}</span>
                <span className="block font-mono text-[10px] text-ink-faint">
                  {account.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

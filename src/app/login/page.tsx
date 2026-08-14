import { redirect } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/auth/session";
import { isQuickLoginEnabled, QUICK_LOGIN_ACCOUNTS } from "@/lib/auth/quick-login";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? No reason to show a form.
  if (await getSessionUser()) redirect("/");

  const locale = await getLocale();
  const t = getDict(locale);

  const quickAccounts = isQuickLoginEnabled()
    ? QUICK_LOGIN_ACCOUNTS.map((account) => ({
        email: account.email,
        label: account.role === "admin" ? t.login.asAdmin : t.login.asOperator,
      }))
    : [];

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand side. Carries the shelf-tag mark so sign-in doesn't feel like a
          different product from the desk behind it. */}
      <aside className="flex flex-col justify-between bg-ink px-8 py-8 text-white lg:px-12 lg:py-12">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="inline-block h-6 w-2 rounded-[1px] bg-brand" />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[0.06em]">
              {t.brand}
            </span>
            <span className="block font-mono text-[10px] tracking-[0.16em] text-white/45 uppercase">
              {t.product}
            </span>
          </span>
        </div>

        <p className="my-10 max-w-sm font-serif text-2xl leading-[1.35] lg:text-[28px]">
          {t.login.pitch}
        </p>

        <LocaleSwitcher current={locale} />
      </aside>

      <main className="flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">{t.login.title}</h1>
          <p className="mt-1 mb-7 text-sm text-ink-soft">{t.login.subtitle}</p>
          <LoginForm t={t} quickAccounts={quickAccounts} />
        </div>
      </main>
    </div>
  );
}

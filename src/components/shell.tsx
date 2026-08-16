import Link from "next/link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NavLinks } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import type { SessionUser } from "@/lib/auth/session";
import { countInboxByFilter } from "@/lib/queries";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

export async function Shell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const locale = await getLocale();
  const t = getDict(locale);
  const counts = await countInboxByFilter();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="bg-ink text-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:flex md:flex-col">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:block md:py-5">
          <Link href="/inbox" className="flex items-center gap-2.5">
            {/* Shelf-tag mark: a red price block next to the wordmark. */}
            <span
              aria-hidden="true"
              className="inline-block h-6 w-2 rounded-[1px] bg-brand"
            />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-[0.06em]">
                {t.brand}
              </span>
              <span className="block font-mono text-[10px] tracking-[0.16em] uppercase text-white/45">
                {t.product}
              </span>
            </span>
          </Link>
          <div className="md:hidden">
            <LocaleSwitcher current={locale} />
          </div>
        </div>

        <div className="overflow-x-auto px-2 pb-3 md:mt-4 md:overflow-visible md:px-0 md:pb-0">
          {/* The queue comes first, because it is the job. */}
          <NavLinks
            items={[
              { href: "/inbox", label: t.nav.inbox, badge: counts.to_answer },
              { href: "/overview", label: t.nav.dashboard },
              { href: "/locations", label: t.nav.locations },
              { href: "/settings", label: t.nav.settings },
            ]}
          />
        </div>

        {/*
          Sits under the nav rather than pinned to the bottom of the rail. The
          bottom-left corner of the viewport is contested space — Chrome parks
          its link-target tooltip there, and the Next dev indicator sits there
          too — so a control that lives in it is a control that gets covered.
        */}
        <div className="hidden px-4 pt-5 md:block">
          <p className="eyebrow mb-2 text-white/35">{t.common.language}</p>
          <LocaleSwitcher current={locale} />
        </div>

        {/* Visible at every size — signing out from a phone has to be possible. */}
        <div className="border-t border-white/10 px-4 py-3 md:mt-6 md:py-4">
          <UserMenu
            user={user}
            signOutLabel={t.login.signOut}
            roleLabel={user.role === "admin" ? t.login.roleAdmin : t.login.roleOperator}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

/** Page header used by every route: eyebrow, title, optional right-hand slot. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule px-5 py-5 md:px-8 md:py-7">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] md:text-[28px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions";
import { LOCALES, type Locale } from "@/lib/i18n";

const SHORT: Record<Locale, string> = { ro: "RO", ru: "RU", en: "EN" };

export function LocaleSwitcher({ current }: { current: Locale }) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="flex items-center gap-px overflow-hidden rounded-[2px] border border-white/15"
      aria-busy={pending}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => startTransition(() => setLocaleAction(locale))}
            aria-pressed={active}
            className={`font-mono text-[11px] tracking-[0.1em] px-2 py-1 transition-colors ${
              active
                ? "bg-white/90 text-ink"
                : "text-white/55 hover:bg-white/10 hover:text-white"
            }`}
          >
            {SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
}

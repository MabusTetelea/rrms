"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: number };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 md:flex-col md:gap-px" aria-label="Sections">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center justify-between gap-3 px-3 py-2 text-sm transition-colors md:px-4 ${
              active
                ? "bg-white/95 text-ink font-medium"
                : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span
                className={`tabular font-mono text-[11px] px-1.5 py-px rounded-[2px] ${
                  active ? "bg-brand text-white" : "bg-white/15 text-white/80"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

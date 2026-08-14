"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { InboxFilter, InboxSort } from "@/lib/queries";

export type FilterOption = { value: InboxFilter; label: string; count: number };
export type StoreOption = { id: string; name: string };
export type SortOption = { value: InboxSort; label: string };

export function InboxFilters({
  filters,
  stores,
  sorts,
  allStoresLabel,
  searchLabel,
  sortLabel,
  active,
  activeSort,
}: {
  filters: FilterOption[];
  stores: StoreOption[];
  sorts: SortOption[];
  allStoresLabel: string;
  searchLabel: string;
  sortLabel: string;
  active: InboxFilter;
  activeSort: InboxSort;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlTerm = params.get("q") ?? "";
  const [term, setTerm] = useState(urlTerm);
  const [lastUrlTerm, setLastUrlTerm] = useState(urlTerm);

  // Keep the box in step when the URL changes from elsewhere (back button,
  // links). Adjusting during render rather than in an effect avoids a second
  // render pass — see react.dev "You Might Not Need an Effect".
  if (urlTerm !== lastUrlTerm) {
    setLastUrlTerm(urlTerm);
    setTerm(urlTerm);
  }

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Changing the queue invalidates whichever review was open.
    next.delete("r");
    router.push(`/inbox?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-px overflow-hidden rounded-[2px] border border-rule">
        {filters.map((filter) => {
          const isActive = filter.value === active;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => navigate({ filter: filter.value })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-ink text-white"
                  : "bg-surface text-ink-soft hover:bg-rule-soft"
              }`}
            >
              {filter.label}
              <span
                className={`tabular font-mono text-[10px] ${
                  isActive ? "text-white/60" : "text-ink-faint"
                }`}
              >
                {filter.count}
              </span>
            </button>
          );
        })}
      </div>

      <select
        value={params.get("store") ?? ""}
        onChange={(event) => navigate({ store: event.target.value || null })}
        aria-label={allStoresLabel}
        className="max-w-[200px] rounded-[2px] border border-rule bg-surface px-2.5 py-1.5 text-[13px]"
      >
        <option value="">{allStoresLabel}</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>

      <select
        value={activeSort}
        onChange={(event) => navigate({ sort: event.target.value })}
        aria-label={sortLabel}
        className="rounded-[2px] border border-rule bg-surface px-2.5 py-1.5 text-[13px]"
      >
        {sorts.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ q: term.trim() || null });
        }}
      >
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="w-44 rounded-[2px] border border-rule bg-surface px-2.5 py-1.5 text-[13px] placeholder:text-ink-faint"
        />
      </form>
    </div>
  );
}

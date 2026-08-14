"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export type ZoneOption = { id: string; label: string; count: number };

/**
 * Search and zone filter for the stores list. State lives in the URL so a
 * filtered view can be bookmarked and shared with whoever owns that zone.
 */
export function StoreSearch({
  zones,
  searchLabel,
  allZonesLabel,
  clearLabel,
}: {
  zones: ZoneOption[];
  searchLabel: string;
  allZonesLabel: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const urlTerm = params.get("q") ?? "";
  const [term, setTerm] = useState(urlTerm);
  const [lastUrlTerm, setLastUrlTerm] = useState(urlTerm);

  // Resync when the URL changes from elsewhere, without an effect.
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
    const query = next.toString();
    router.push(query ? `/locations?${query}` : "/locations");
  }

  const activeZone = params.get("zone") ?? "";
  const hasFilters = Boolean(activeZone || urlTerm);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ q: term.trim() || null });
        }}
        className="flex items-center gap-2"
      >
        <input
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            // A search box that needs Enter feels broken; clearing it should
            // restore the full list immediately.
            if (event.target.value === "") navigate({ q: null });
          }}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="w-56 rounded-[2px] border border-rule bg-surface px-2.5 py-1.5 text-[13px] placeholder:text-ink-faint sm:w-72"
        />
      </form>

      <select
        value={activeZone}
        onChange={(event) => navigate({ zone: event.target.value || null })}
        aria-label={allZonesLabel}
        className="max-w-[220px] rounded-[2px] border border-rule bg-surface px-2.5 py-1.5 text-[13px]"
      >
        <option value="">{allZonesLabel}</option>
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.label} ({zone.count})
          </option>
        ))}
      </select>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.push("/locations")}
          className="rounded-[2px] border border-rule px-2.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-rule-soft"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

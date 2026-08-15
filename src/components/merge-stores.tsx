"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { mergeLocationAction, unmergeLocationAction } from "@/app/actions";
import type { Dict } from "@/lib/i18n";

export type MergeCandidate = {
  id: string;
  name: string;
  source: string;
  city: string | null;
};

export type MergedMember = { id: string; name: string; source: string };

/**
 * Admin control for folding the same shop's listings together — duplicate
 * Google listings, or rows left behind by a source migration. Auto-matching
 * isn't viable, because duplicates differ in name and address formatting and a
 * wrong pairing silently corrupts a store's rating. So it's a human decision.
 */
export function MergeStores({
  storeId,
  storeSource,
  mergedFrom,
  candidates,
  t,
}: {
  storeId: string;
  storeSource: string;
  mergedFrom: MergedMember[];
  candidates: MergeCandidate[];
  t: Dict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error ?? "Failed");
      else router.refresh();
    });
  }

  return (
    <section>
      <h2 className="text-[15px] font-semibold">{t.merge.title}</h2>
      <p className="mt-0.5 mb-3 text-xs text-ink-faint">{t.merge.hint}</p>

      <ul className="border-t border-rule">
        {/* This store's own listing, then anything folded into it. */}
        <li className="flex items-center justify-between gap-3 border-b border-rule py-2">
          <span className="min-w-0 truncate text-sm">
            <span className="mr-2 rounded-[2px] bg-ink px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-white uppercase">
              {storeSource}
            </span>
            {t.merge.thisListing}
          </span>
        </li>

        {mergedFrom.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 border-b border-rule py-2"
          >
            <span className="min-w-0 truncate text-sm">
              <span className="mr-2 rounded-[2px] bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-ink-soft uppercase">
                {row.source}
              </span>
              {row.name}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unmergeLocationAction(row.id))}
              className="shrink-0 rounded-[2px] border border-rule px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-rule-soft disabled:opacity-50"
            >
              {t.merge.separate}
            </button>
          </li>
        ))}
      </ul>

      {candidates.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            aria-label={t.merge.pick}
            className="max-w-[280px] rounded-[2px] border border-rule bg-surface px-2.5 py-1.5 text-[13px]"
          >
            <option value="">{t.merge.pick}</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                [{candidate.source}] {candidate.name}
                {candidate.city ? ` — ${candidate.city}` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={pending || !target}
            onClick={() => run(() => mergeLocationAction(target, storeId))}
            className="rounded-[2px] bg-ink px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {t.merge.action}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 border-l-2 border-brand bg-brand-soft px-3 py-2 text-xs text-brand">
          {error}
        </p>
      ) : null}
    </section>
  );
}

import Link from "next/link";
import { RatingPrice, StarSpread } from "@/components/rating";
import { ratingBand } from "@/lib/format";
import type { StoreStats } from "@/lib/queries";
import { plural, type Dict, type Locale } from "@/lib/i18n";

const BAND_CHIP: Record<string, string> = {
  good: "bg-good text-white",
  mid: "bg-mid text-white",
  bad: "bg-bad text-white",
};

/**
 * A store rendered as a shelf-edge label: code block, name, the star spread,
 * and the rating set like a price on the right.
 */
export function StoreStrip({
  store,
  t,
  locale,
}: {
  store: StoreStats;
  t: Dict;
  locale: Locale;
}) {
  const band = store.avgRating != null ? ratingBand(store.avgRating) : "mid";

  return (
    <Link
      href={`/locations/${store.id}`}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 border-b border-rule bg-surface px-3 py-3 transition-colors hover:bg-rule-soft/60 sm:grid-cols-[auto_minmax(0,1fr)_minmax(120px,200px)_auto] sm:gap-x-5 sm:px-4"
    >
      <span
        className={`tabular grid h-9 w-11 place-items-center rounded-[2px] font-mono text-[13px] font-semibold tracking-[0.06em] ${
          BAND_CHIP[band]
        }`}
        aria-hidden="true"
      >
        {store.code}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium">{store.name}</span>
        <span className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-ink-faint">
          <span className="tabular">
            {plural(locale, store.totalReviews, t.plurals.reviews)}
          </span>
          {store.unanswered > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular text-brand">
                {store.unanswered} {t.common.unanswered}
              </span>
            </>
          ) : null}
        </span>
      </span>

      <span className="col-span-3 sm:col-span-1 sm:pr-2">
        <StarSpread histogram={store.histogram} />
      </span>

      <span className="col-start-3 row-start-1 justify-self-end sm:col-start-4">
        <RatingPrice value={store.avgRating} className="text-[30px]" />
      </span>
    </Link>
  );
}

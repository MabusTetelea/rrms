import Link from "next/link";
import { RatingPrice } from "@/components/rating";
import { plural, type Dict, type Locale } from "@/lib/i18n";
import type { Overview, ZoneStats } from "@/lib/queries";

/**
 * The overview opens on the two numbers a shift actually turns on: how much
 * work is waiting, and where the chain stands. Everything else on the page is
 * detail underneath that statement.
 *
 * Deliberately not a row of equal stat tiles — four numbers of equal weight
 * tell an operator nothing about what to do first.
 */
export function OverviewHero({
  overview,
  worstZone,
  t,
  locale,
}: {
  overview: Overview;
  worstZone: ZoneStats | null;
  t: Dict;
  locale: Locale;
}) {
  return (
    <section className="border border-rule bg-surface">
      <div className="grid gap-8 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-7 sm:py-7">
        {/* The work waiting. */}
        <div className="min-w-0">
          <p className="eyebrow">{t.dashboard.unanswered}</p>
          <p
            className={`display mt-3 ${
              overview.unanswered > 0 ? "text-ink" : "text-good"
            }`}
          >
            {overview.unanswered}
          </p>
        </div>

        {/* Where the chain stands. The one place the price motif appears here. */}
        <div className="sm:text-right">
          <p className="eyebrow">{t.dashboard.avgRating}</p>
          <div className="mt-3">
            <RatingPrice value={overview.avgRating} className="text-6xl" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule px-5 py-3 font-mono text-[11px] text-ink-soft sm:px-7">
        <span>
          {t.dashboard.heroOf}{" "}
          <span className="figure text-ink">{overview.totalReviews}</span>{" "}
          {t.dashboard.heroTracked}
        </span>
        <Link href="/inbox?filter=to_answer" className="hover:text-ink">
          <span className="figure text-bad">{overview.negativeRecent}</span>{" "}
          {t.dashboard.heroNegative}
        </Link>
      </div>

      {/* The one instruction: where to start. */}
      {worstZone && worstZone.unanswered > 0 ? (
        <Link
          href={`/locations?zone=${worstZone.zone}`}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-rule bg-brand-soft px-5 py-3 text-sm transition-colors hover:bg-brand/10 sm:px-7"
        >
          <span aria-hidden="true" className="text-brand">
            →
          </span>
          <span className="text-ink-soft">{t.dashboard.heroWorst}</span>
          <span className="font-medium text-ink">{t.zones[worstZone.zone]}</span>
          <span className="text-ink-soft">
            — <span className="figure text-brand">{worstZone.unanswered}</span>{" "}
            {t.common.unanswered}
            {worstZone.negativeUnanswered > 0 ? (
              <>
                {", "}
                {plural(locale, worstZone.negativeUnanswered, t.plurals.reviews)}{" "}
                {t.dashboard.heroAtOneTwo}
              </>
            ) : null}
          </span>
        </Link>
      ) : (
        <p className="border-t border-rule bg-good-soft px-5 py-3 text-sm text-good sm:px-7">
          {t.dashboard.heroClear}
        </p>
      )}
    </section>
  );
}

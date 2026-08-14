import Link from "next/link";
import { RatingPrice } from "@/components/rating";
import { plural, type Dict, type Locale } from "@/lib/i18n";
import type { ZoneStats } from "@/lib/queries";
import { ZONE_META } from "@/lib/zones";

/**
 * A zone rendered as a shelf-edge strip — same language as the store rows, but
 * the headline figure is the unanswered queue, not the rating. On this screen
 * the backlog is what the operator is deciding on.
 */
export function ZoneStrip({
  zone,
  t,
  locale,
  maxBacklog,
}: {
  zone: ZoneStats;
  t: Dict;
  locale: Locale;
  maxBacklog: number;
}) {
  const meta = ZONE_META[zone.zone];
  const share = maxBacklog > 0 ? (zone.unanswered / maxBacklog) * 100 : 0;
  const negativeShare =
    zone.unanswered > 0 ? (zone.negativeUnanswered / zone.unanswered) * 100 : 0;

  return (
    <Link
      href={`/locations?zone=${zone.zone}`}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 border-b border-rule bg-surface px-3 py-3 transition-colors hover:bg-rule-soft/60 sm:grid-cols-[auto_minmax(0,1fr)_minmax(110px,180px)_auto] sm:gap-x-5 sm:px-4"
    >
      <span
        className="tabular grid h-9 w-11 place-items-center rounded-[2px] bg-ink font-mono text-[13px] font-semibold tracking-[0.06em] text-white"
        aria-hidden="true"
      >
        {meta.code}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium">
          {t.zones[zone.zone]}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-faint">
          <span className="tabular">
            {plural(locale, zone.storeCount, t.plurals.stores)}
          </span>
          {zone.worstStore ? (
            <>
              <span aria-hidden="true"> · </span>
              {t.dashboard.zoneWorst}: {zone.worstStore.name.replace(/^Linella\s*[—–-]\s*/, "")}{" "}
              <span className="tabular">{zone.worstStore.avgRating?.toFixed(2)}</span>
            </>
          ) : null}
        </span>
      </span>

      {/* Backlog magnitude, with the angry share called out inside it. */}
      <span className="col-span-3 sm:col-span-1 sm:pr-2">
        <span
          className="flex h-2 overflow-hidden rounded-[1px] bg-rule-soft"
          role="img"
          aria-label={`${zone.unanswered} ${t.common.unanswered}, ${zone.negativeUnanswered} 1-2★`}
        >
          <span className="flex h-full" style={{ width: `${share}%` }}>
            <span
              className="h-full bg-bad"
              style={{ width: `${negativeShare}%` }}
              title={`${zone.negativeUnanswered} × 1–2★`}
            />
            <span className="h-full flex-1 bg-mid/45" />
          </span>
        </span>
      </span>

      <span className="col-start-3 row-start-1 flex items-baseline justify-self-end gap-3 sm:col-start-4">
        <RatingPrice value={zone.avgRating} className="text-lg" />
        <span
          className={`price text-[30px] ${zone.unanswered > 0 ? "text-brand" : "text-ink-faint"}`}
        >
          {zone.unanswered}
        </span>
      </span>
    </Link>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { MergeStores } from "@/components/merge-stores";
import { RatingPrice, StarRow, StarSpread } from "@/components/rating";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getDict, plural } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import {
  getMergeCandidates,
  getRecentReviewsForStore,
  getStore,
  getStoreTrend,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getDict(locale);

  const user = await requireUser();
  const store = await getStore(id);
  if (!store) notFound();

  // getStore resolves a merged row to its canonical store, so everything below
  // keys off store.id — using the URL id would scope the rollups to a satellite.
  const [recent, trend, [own], candidates] = await Promise.all([
    getRecentReviewsForStore(store.id),
    getStoreTrend(store.id),
    db
      .select({ source: locations.source })
      .from(locations)
      .where(eq(locations.id, store.id)),
    user.role === "admin" ? getMergeCandidates(store.id) : Promise.resolve([]),
  ]);

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const total = store.histogram.reduce((a, b) => a + b, 0);

  return (
    <>
      <header className="border-b border-rule px-5 py-5 md:px-8 md:py-7">
        <Link
          href="/locations"
          className="font-mono text-[11px] tracking-[0.1em] text-ink-faint uppercase hover:text-ink"
        >
          ← {t.locations.backToStores}
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="tabular grid h-8 w-11 place-items-center rounded-[2px] bg-ink font-mono text-[13px] font-semibold tracking-[0.06em] text-white">
                {store.code}
              </span>
              <h1 className="truncate text-2xl font-semibold md:text-[28px]">
                {store.name}
              </h1>
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
              <Link
                href={`/locations?zone=${store.zone}`}
                className="rounded-[2px] border border-rule bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-rule"
              >
                {t.zones[store.zone]}
              </Link>
              {store.address ? <span>{store.address}</span> : null}
            </p>
          </div>

          <div className="flex items-end gap-6">
            <div className="text-right">
              <p className="eyebrow">{t.locations.rating}</p>
              <RatingPrice value={store.avgRating} className="text-5xl" />
            </div>
            <div className="text-right">
              <p className="eyebrow">{t.locations.reviews}</p>
              <p className="figure text-3xl">{store.totalReviews}</p>
            </div>
            <div className="text-right">
              <p className="eyebrow">{t.locations.unanswered}</p>
              <p
                className={`figure text-3xl ${store.unanswered > 0 ? "text-brand" : ""}`}
              >
                {store.unanswered}
              </p>
            </div>
          </div>
        </div>

        <Link
          href={`/inbox?filter=unanswered&store=${store.id}`}
          className="mt-5 inline-block rounded-[2px] bg-ink px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          {t.locations.answerThese}
        </Link>
      </header>

      <div className="grid gap-8 px-5 py-6 md:px-8 md:py-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <section>
          <h2 className="text-[15px] font-semibold">{t.locations.recentReviews}</h2>
          <ul className="mt-3 border-t border-rule">
            {recent.map((review) => (
              <li
                key={review.id}
                className="border-b border-rule bg-surface px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <StarRow rating={review.rating} size={12} />
                  <span className="font-mono text-[11px] text-ink-faint">
                    {review.authorName ?? "—"} ·{" "}
                    {dateFormat.format(new Date(review.publishedAt))}
                  </span>
                </div>
                {review.text ? (
                  <p className="mt-2 font-serif text-[15px] leading-[1.55]">
                    {review.text}
                  </p>
                ) : null}
                <Link
                  href={`/inbox?filter=all&r=${review.id}`}
                  className="mt-2 inline-block text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  {t.inbox.title} →
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-8">
          {user.role === "admin" ? (
            <MergeStores
              storeId={store.id}
              storeSource={own?.source ?? "—"}
              mergedFrom={store.mergedFrom}
              candidates={candidates}
              t={t}
            />
          ) : store.mergedFrom.length > 0 ? (
            <section>
              <h2 className="text-[15px] font-semibold">{t.merge.title}</h2>
              <ul className="mt-3 border-t border-rule">
                {store.mergedFrom.map((row) => (
                  <li key={row.id} className="border-b border-rule py-2 text-sm">
                    <span className="mr-2 rounded-[2px] bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-ink-soft uppercase">
                      {row.source}
                    </span>
                    {row.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-[15px] font-semibold">{t.locations.spread}</h2>
            <StarSpread histogram={store.histogram} className="mt-3 h-3" />
            <ul className="mt-3 border-t border-rule">
              {[5, 4, 3, 2, 1].map((stars) => {
                const value = store.histogram[stars - 1];
                const share = total ? Math.round((value / total) * 100) : 0;
                return (
                  <li
                    key={stars}
                    className="flex items-center gap-3 border-b border-rule py-1.5"
                  >
                    <span className="tabular w-6 font-mono text-[11px] text-ink-faint">
                      {stars}★
                    </span>
                    <span className="h-1.5 flex-1 bg-rule-soft">
                      <span
                        className="block h-full bg-ink/70"
                        style={{ width: `${share}%` }}
                      />
                    </span>
                    <span className="tabular w-14 text-right font-mono text-[11px] text-ink-soft">
                      {value} · {share}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {trend.length > 1 ? (
            <section>
              <h2 className="text-[15px] font-semibold">
                {t.dashboard.avgRating} · 6M
              </h2>
              <ul className="mt-3 border-t border-rule">
                {trend.map((point) => (
                  <li
                    key={point.month}
                    className="flex items-center justify-between gap-3 border-b border-rule py-2"
                  >
                    <span className="font-mono text-[11px] text-ink-faint">
                      {point.month}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular font-mono text-[11px] text-ink-faint">
                        {plural(locale, point.total, t.plurals.reviews)}
                      </span>
                      <RatingPrice value={point.avg} className="text-xl" />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

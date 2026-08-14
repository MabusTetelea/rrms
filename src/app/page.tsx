import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { RatingPrice } from "@/components/rating";
import { StoreStrip } from "@/components/store-strip";
import { SyncButton } from "@/components/sync-button";
import { ZoneStrip } from "@/components/zone-strip";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import {
  getBacklogStores,
  getOverview,
  getTopicStats,
  getZoneStats,
} from "@/lib/queries";
import type { Topic } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = getDict(locale);

  const [overview, zones, backlog, topics] = await Promise.all([
    getOverview(),
    getZoneStats(),
    getBacklogStores(),
    getTopicStats(),
  ]);

  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const maxBacklog = zones.reduce((max, zone) => Math.max(max, zone.unanswered), 0);
  const zonesNeedingWork = zones.filter((zone) => zone.unanswered > 0);

  return (
    <>
      <PageHeader
        title={t.dashboard.title}
        subtitle={t.dashboard.subtitle}
        actions={
          <SyncButton
            label={t.dashboard.syncNow}
            busyLabel={t.dashboard.syncing}
            failedLabel={t.dashboard.syncFailed}
          />
        }
      />

      {overview.totalReviews === 0 ? (
        <EmptyState title={t.dashboard.emptyTitle} body={t.dashboard.emptyBody} />
      ) : (
        <div className="px-5 py-6 md:px-8 md:py-8">
          {/* Headline numbers ------------------------------------------- */}
          <section className="grid grid-cols-2 border border-rule bg-surface lg:grid-cols-4">
            <Tile label={t.dashboard.avgRating}>
              <RatingPrice value={overview.avgRating} className="text-5xl" />
            </Tile>
            <Tile label={t.dashboard.totalReviews}>
              <Figure>{overview.totalReviews}</Figure>
            </Tile>
            <Tile label={t.dashboard.unanswered}>
              <Link href="/inbox" className="hover:underline">
                <Figure tone={overview.unanswered > 0 ? "brand" : undefined}>
                  {overview.unanswered}
                </Figure>
              </Link>
            </Tile>
            <Tile label={t.dashboard.negative}>
              <Link href="/inbox?filter=negative" className="hover:underline">
                <Figure tone={overview.negativeRecent > 0 ? "bad" : undefined}>
                  {overview.negativeRecent}
                </Figure>
              </Link>
            </Tile>
          </section>

          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            {t.dashboard.lastSync}:{" "}
            {overview.lastSync
              ? `${dateFormat.format(overview.lastSync.at)} · ${overview.lastSync.source} · +${overview.lastSync.reviewsNew}`
              : t.dashboard.never}
          </p>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
            <div className="space-y-8">
              {/* Zones that need work -------------------------------- */}
              <section>
                <SectionHead
                  title={t.dashboard.zonesTitle}
                  hint={t.dashboard.zonesHint}
                />
                {zonesNeedingWork.length === 0 ? (
                  <div className="border border-rule bg-surface px-4 py-10 text-center">
                    <p className="font-medium">{t.dashboard.allCaughtUp}</p>
                    <p className="mt-1 text-sm text-ink-faint">
                      {t.dashboard.allCaughtUpBody}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 px-3 pb-1.5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(110px,180px)_auto] sm:px-4">
                      <span className="eyebrow">{t.locations.zone}</span>
                      <span className="eyebrow" />
                      <span className="eyebrow hidden sm:block">
                        {t.dashboard.zoneBacklog}
                      </span>
                      <span className="eyebrow hidden justify-self-end sm:block">
                        {t.locations.rating} · {t.dashboard.zoneBacklog}
                      </span>
                    </div>
                    <div className="border-t border-rule">
                      {zonesNeedingWork.map((zone) => (
                        <ZoneStrip
                          key={zone.zone}
                          zone={zone}
                          t={t}
                          locale={locale}
                          maxBacklog={maxBacklog}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* The individual shops behind those zone numbers ------- */}
              {backlog.length > 0 ? (
                <section>
                  <SectionHead
                    title={t.dashboard.backlogTitle}
                    hint={t.dashboard.backlogHint}
                  />
                  <div className="border-t border-rule">
                    {backlog.map((store) => (
                      <StoreStrip
                        key={store.id}
                        store={store}
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </div>
                  <Link
                    href="/locations"
                    className="mt-3 inline-block text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
                  >
                    {t.locations.backToStores} →
                  </Link>
                </section>
              ) : null}
            </div>

            {/* Topic tags ------------------------------------------------ */}
            <section>
              <SectionHead title={t.dashboard.topics} hint={t.dashboard.topicsHint} />
              {topics.length === 0 ? (
                <p className="border-t border-rule py-4 text-sm text-ink-faint">
                  {t.common.none}
                </p>
              ) : (
                <ul className="border-t border-rule">
                  {topics.map((topic) => (
                    <li
                      key={topic.topic}
                      className="flex items-baseline justify-between gap-3 border-b border-rule bg-surface px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm">
                        {t.topics[topic.topic as Topic] ?? topic.topic}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3 font-mono text-[11px] text-ink-faint">
                        <span className="tabular">
                          {topic.mentions} {t.dashboard.topicMentions}
                        </span>
                        <RatingPrice value={topic.avgRating} className="text-base" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-r border-rule px-4 py-4 last:border-r-0 lg:border-b-0">
      <p className="eyebrow">{label}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Figure({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "brand" | "bad";
}) {
  const color = tone === "brand" ? "text-brand" : tone === "bad" ? "text-bad" : "";
  return <span className={`price text-5xl ${color}`}>{children}</span>;
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[15px] font-semibold tracking-[-0.005em]">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 py-16 text-center md:px-8">
      <p className="text-lg font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
    </div>
  );
}

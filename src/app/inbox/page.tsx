import Link from "next/link";
import { InboxFilters } from "@/components/inbox-filters";
import { QueueKeys } from "@/components/queue-keys";
import { StarRow } from "@/components/rating";
import { ReplyPanel } from "@/components/reply-panel";
import { isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import {
  countInboxByFilter,
  getInbox,
  getReviewDetail,
  getStoreStats,
  INBOX_FILTERS,
  type InboxFilter,
  type InboxItem,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDict(locale);

  const filterParam = one(params.filter);
  const filter: InboxFilter = INBOX_FILTERS.includes(filterParam as InboxFilter)
    ? (filterParam as InboxFilter)
    : "unanswered";
  const storeId = one(params.store);
  const q = one(params.q);
  const selectedId = one(params.r);

  const [items, counts, stores] = await Promise.all([
    getInbox({ filter, locationId: storeId, q }),
    countInboxByFilter(storeId),
    getStoreStats(),
  ]);

  const selected = selectedId ? await getReviewDetail(selectedId) : null;
  const aiEnabled = isOpenRouterConfigured();

  const filterLabels: Record<InboxFilter, string> = {
    unanswered: t.inbox.filterUnanswered,
    negative: t.inbox.filterNegative,
    replied: t.inbox.filterReplied,
    skipped: t.inbox.filterSkipped,
    all: t.inbox.filterAll,
  };

  function hrefFor(reviewId: string) {
    const next = new URLSearchParams();
    next.set("filter", filter);
    if (storeId) next.set("store", storeId);
    if (q) next.set("q", q);
    next.set("r", reviewId);
    return `/inbox?${next.toString()}`;
  }

  const queueHref = (() => {
    const next = new URLSearchParams();
    next.set("filter", filter);
    if (storeId) next.set("store", storeId);
    if (q) next.set("q", q);
    return `/inbox?${next.toString()}`;
  })();

  const queueHrefs = items.map((item) => hrefFor(item.id));
  const currentIndex = selectedId
    ? items.findIndex((item) => item.id === selectedId)
    : -1;

  return (
    <div className="flex flex-col md:h-screen">
      <QueueKeys hrefs={queueHrefs} currentIndex={currentIndex} />
      <header className="shrink-0 border-b border-rule px-5 py-4 md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{t.inbox.title}</h1>
          <InboxFilters
            active={filter}
            filters={INBOX_FILTERS.map((value) => ({
              value,
              label: filterLabels[value],
              count: counts[value],
            }))}
            stores={stores.map((s) => ({ id: s.id, name: s.name }))}
            allStoresLabel={t.inbox.allStores}
            searchLabel={t.common.search}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Queue -------------------------------------------------------- */}
        <section
          className={`thin-scroll w-full shrink-0 overflow-y-auto border-rule md:w-[340px] md:border-r ${
            selected ? "hidden md:block" : "block"
          }`}
          aria-label={t.inbox.title}
        >
          {items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium">{t.inbox.queueEmpty}</p>
              <p className="mt-1 text-sm text-ink-faint">{t.inbox.queueEmptyBody}</p>
            </div>
          ) : (
            <ul>
              <li className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-rule bg-paper/95 px-4 py-1.5 backdrop-blur">
                <span className="figure text-[11px] text-ink-faint">
                  {items.length}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
                  <kbd className="kbd">J</kbd>
                  <kbd className="kbd">K</kbd>
                </span>
              </li>
              {items.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  href={hrefFor(item.id)}
                  active={item.id === selectedId}
                  locale={locale}
                  noTextLabel={t.inbox.noText}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Detail ------------------------------------------------------- */}
        <section className={`min-w-0 flex-1 ${selected ? "block" : "hidden md:block"}`}>
          {selected ? (
            <>
              <Link
                href={queueHref}
                className="block border-b border-rule px-5 py-2.5 text-sm text-ink-soft md:hidden"
              >
                ← {t.inbox.title}
              </Link>
              <ReplyPanel
                key={selected.id}
                review={selected}
                t={t}
                locale={locale}
                aiEnabled={aiEnabled}
              />
            </>
          ) : (
            <div className="grid h-full place-items-center px-6 py-20 text-center">
              <div>
                <p className="text-lg font-medium">{t.inbox.pickOne}</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
                  {t.inbox.pickOneBody}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  new: "bg-brand",
  in_progress: "bg-mid",
  replied: "bg-good",
  skipped: "bg-ink-faint",
};

function QueueRow({
  item,
  href,
  active,
  locale,
  noTextLabel,
}: {
  item: InboxItem;
  href: string;
  active: boolean;
  locale: string;
  noTextLabel: string;
}) {
  const date = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(new Date(item.publishedAt));

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={`block border-b border-rule px-4 py-3 transition-colors ${
          active ? "bg-ink text-white" : "bg-surface hover:bg-rule-soft/70"
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <StarRow rating={item.rating} size={11} />
          <span
            className={`font-mono text-[10px] tracking-[0.08em] ${
              active ? "text-white/55" : "text-ink-faint"
            }`}
          >
            {item.storeCode} · {date}
          </span>
        </span>

        <span
          className={`mt-1.5 line-clamp-2 block font-serif text-[13.5px] leading-[1.45] ${
            active ? "text-white/85" : item.text ? "text-ink" : "text-ink-faint italic"
          }`}
        >
          {item.text ?? noTextLabel}
        </span>

        <span className="mt-1.5 flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[item.status] ?? "bg-ink-faint"}`}
          />
          <span
            className={`truncate font-mono text-[10px] ${
              active ? "text-white/50" : "text-ink-faint"
            }`}
          >
            {item.authorName ?? "—"}
          </span>
        </span>
      </Link>
    </li>
  );
}

import Link from "next/link";
import { InboxFilters } from "@/components/inbox-filters";
import { QueueKeys } from "@/components/queue-keys";
import { StarRow } from "@/components/rating";
import { ReplyPanel } from "@/components/reply-panel";
import { isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { getPublishingSource } from "@/lib/sources";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import {
  countInboxByFilter,
  getInbox,
  getReviewDetail,
  getStoreStats,
  INBOX_FILTERS,
  INBOX_MAX_WINDOW,
  INBOX_PAGE_SIZE,
  INBOX_SORTS,
  QUEUE_SORTS,
  type InboxFilter,
  type InboxItem,
  type InboxSort,
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
    : "to_answer";
  const storeId = one(params.store);
  const q = one(params.q);
  const isDone = filter === "done";

  // Done reads as a record — most recently handled first. The work queue reads
  // worst-first, because that's the review costing the most while it waits.
  const defaultSort: InboxSort = isDone ? "handled" : "worst";
  const sortParam = one(params.sort);
  const sort: InboxSort = INBOX_SORTS.includes(sortParam as InboxSort)
    ? (sortParam as InboxSort)
    : defaultSort;

  /*
   * How many rows the queue is currently allowed to show. It grows a page at a
   * time via the link at the foot of the queue, and rides in the URL so it
   * survives clicking a review — otherwise opening one would collapse the
   * queue back to the first page and lose the operator's place.
   */
  const showParam = Number(one(params.show));
  const show = Number.isFinite(showParam)
    ? Math.min(Math.max(showParam, INBOX_PAGE_SIZE), INBOX_MAX_WINDOW)
    : INBOX_PAGE_SIZE;

  const [items, counts, stores] = await Promise.all([
    getInbox({ filter, locationId: storeId, q, sort, limit: show }),
    countInboxByFilter(storeId, q),
    getStoreStats(),
  ]);

  // The queue can hold more than it is showing; the count above it has to say
  // so, or the operator has no way to know the list stops short of the total.
  const total = counts[filter];
  const hasMore = items.length < total && items.length < INBOX_MAX_WINDOW;
  const nextShow = Math.min(items.length + INBOX_PAGE_SIZE, INBOX_MAX_WINDOW);

  /*
   * Open the first review automatically.
   *
   * Landing on an empty panel meant every session began with the same pointless
   * click. The queue is ordered worst-first, so the review that opens is the one
   * that most deserves an answer.
   */
  // ...unless the operator explicitly asked for the list. On a phone the queue
  // and the review share the screen, so "← back to the queue" needs a way to
  // say "show me the list" that auto-select won't immediately undo.
  const wantsList = one(params.list) === "1";
  const selectedId = one(params.r) ?? (wantsList ? undefined : items[0]?.id);
  const selected = selectedId ? await getReviewDetail(selectedId) : null;
  const aiEnabled = isOpenRouterConfigured();
  // Only offer Publish for reviews that came from the source that can publish.
  const publisher = getPublishingSource();
  const publishEnabled = Boolean(publisher && selected?.source === publisher.name);

  const filterLabels: Record<InboxFilter, string> = {
    to_answer: t.inbox.filterToAnswer,
    done: t.inbox.filterDone,
    all: t.inbox.filterAll,
  };

  function queryFor(reviewId?: string, window = show) {
    const next = new URLSearchParams();
    next.set("filter", filter);
    if (sort !== defaultSort) next.set("sort", sort);
    if (storeId) next.set("store", storeId);
    if (q) next.set("q", q);
    if (window > INBOX_PAGE_SIZE) next.set("show", String(window));
    if (reviewId) next.set("r", reviewId);
    return `/inbox?${next.toString()}`;
  }

  const hrefFor = (reviewId: string) => queryFor(reviewId);
  const queueHref = `${queryFor()}&list=1`;
  // Growing the queue keeps whatever review is open — it's the same list,
  // just longer.
  const moreHref = queryFor(selectedId, nextShow);

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
            activeSort={sort}
            // "Recently handled" is only meaningful once something has been
            // handled, so it is offered on the Done tab and nowhere else.
            sorts={(isDone ? INBOX_SORTS : QUEUE_SORTS).map((value) => ({
              value,
              label: t.sort[value],
            }))}
            sortLabel={t.sort.label}
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
              <p className="font-medium">
                {isDone ? t.inbox.queueDoneEmpty : t.inbox.queueEmpty}
              </p>
              <p className="mt-1 text-sm text-ink-faint">
                {isDone ? t.inbox.queueDoneEmptyBody : t.inbox.queueEmptyBody}
              </p>
            </div>
          ) : (
            <ul>
              <li className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-rule bg-paper/95 px-4 py-1.5 backdrop-blur">
                <span className="figure text-[11px] text-ink-faint">
                  {/* Only spell out the ratio while the list is short of the
                      total — "200 shown of 390" when it matters, a plain count
                      when there is nothing being held back. */}
                  {items.length < total
                    ? `${items.length} ${t.inbox.showingOf} ${total}`
                    : items.length}
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
                  sentByLabel={t.inbox.sentBy}
                />
              ))}
              {hasMore ? (
                <li>
                  {/* scroll={false}: the operator is at the bottom of the queue
                      when they ask for more, and jumping to the top would undo
                      the scroll they just did. */}
                  <Link
                    href={moreHref}
                    scroll={false}
                    className="block border-b border-rule px-4 py-3 text-center text-sm text-ink-soft transition-colors hover:bg-rule-soft hover:text-ink"
                  >
                    {t.inbox.showMore}
                    <span className="tabular ml-1.5 font-mono text-[11px] text-ink-faint">
                      +{nextShow - items.length}
                    </span>
                  </Link>
                </li>
              ) : null}
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
                publishEnabled={publishEnabled}
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
  sentByLabel,
}: {
  item: InboxItem;
  href: string;
  active: boolean;
  locale: string;
  noTextLabel: string;
  sentByLabel: string;
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

        {/* On the Done tab, what was actually sent — the record of past replies
            lives beside the review it answered, not on a separate screen. */}
        {item.replyText ? (
          <span
            className={`mt-2 block border-l-2 pl-2.5 ${
              active ? "border-white/30" : "border-good/50"
            }`}
          >
            <span
              className={`line-clamp-2 block font-serif text-[13px] leading-[1.45] ${
                active ? "text-white/75" : "text-ink-soft"
              }`}
            >
              {item.replyText}
            </span>
            {item.replyOperator ? (
              <span
                className={`mt-0.5 block font-mono text-[10px] ${
                  active ? "text-white/45" : "text-ink-faint"
                }`}
              >
                {sentByLabel} {item.replyOperator}
              </span>
            ) : null}
          </span>
        ) : null}

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

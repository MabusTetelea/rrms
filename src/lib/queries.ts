import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";
import { db } from "@/db";
import { locations, replies, reviews, suggestions, syncRuns } from "@/db/schema";

/** Second reference to `locations` for the merge self-join. */
const member = alias(locations, "member");
import { storeCode } from "@/lib/format";
import type { Topic } from "@/lib/text";
import { isZoneId, type ZoneId } from "@/lib/zones";

const DAY_MS = 86_400_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type Overview = {
  avgRating: number | null;
  totalReviews: number;
  unanswered: number;
  negativeRecent: number;
  lastSync: { at: Date; status: string; source: string; reviewsNew: number } | null;
};

export async function getOverview(): Promise<Overview> {
  const [totals] = await db
    .select({
      total: count(),
      avg: sql<string | null>`avg(${reviews.rating})`,
      // "Waiting" has to mean the same thing here as it does in the queue, or
      // the headline number and the list disagree with each other.
      unanswered: sql<number>`count(*) filter (where ${reviews.status} in ('new','in_progress') and ${reviews.rating} <= ${REPLY_THRESHOLD})::int`,
      negativeRecent: sql<number>`count(*) filter (where ${reviews.rating} <= 2 and ${reviews.publishedAt} >= now() - interval '30 days')::int`,
    })
    .from(reviews);

  const [run] = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  return {
    avgRating: totals?.avg ? Number(Number(totals.avg).toFixed(2)) : null,
    totalReviews: totals?.total ?? 0,
    unanswered: totals?.unanswered ?? 0,
    negativeRecent: totals?.negativeRecent ?? 0,
    lastSync: run
      ? {
          at: run.finishedAt ?? run.startedAt,
          status: run.status,
          source: run.source,
          reviewsNew: run.reviewsNew,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Per-store leaderboard
// ---------------------------------------------------------------------------

/**
 * The store a review rolls up to: itself, unless it has been merged into
 * another. Used everywhere a review is counted, so merged rows never
 * double-count.
 */
/**
 * Reviews belonging to a canonical store, including everything merged into it.
 * Written as EXISTS so it can be dropped into any query over `reviews` without
 * adding a join that would disturb aggregates.
 */
function reviewsInStore(canonicalId: string) {
  return sql`exists (
    select 1 from ${locations} l2
    where l2.id = ${reviews.locationId}
      and coalesce(l2.merged_into, l2.id) = ${canonicalId}
  )`;
}

export type StoreStats = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  zone: ZoneId;
  googleUrl: string | null;
  avgRating: number | null;
  totalReviews: number;
  unanswered: number;
  /** Unanswered reviews rated 1–2. The part of the backlog that actually hurts. */
  negativeUnanswered: number;
  /** Counts for 1★…5★, index 0 = one star. */
  histogram: [number, number, number, number, number];
  /** Other listings folded into this one, e.g. a duplicate Google entry. */
  mergedFrom: { id: string; source: string; name: string }[];
};

export type StoreQuery = {
  /** Free text over store name, city and address. */
  q?: string;
  zone?: ZoneId;
  /** "rating" = worst rated first (default), "backlog" = biggest queue first. */
  sort?: "rating" | "backlog";
  /** One canonical store, for its own page. Skips aggregating the whole estate. */
  id?: string;
};

/**
 * Wrapped in React's `cache` so the several places that want the store table in
 * one request — the zone rollup and the backlog list on the dashboard, say —
 * share a single aggregate instead of running it once each.
 *
 * The dedupe is by argument identity, so it only helps the no-argument calls.
 * That's deliberate: those are the ones that repeat.
 */
export const getStoreStats = cache(getStoreStatsUncached);

async function getStoreStatsUncached(query: StoreQuery = {}): Promise<StoreStats[]> {
  // Canonical rows only — merged ones are folded in below.
  const conditions = [eq(locations.active, true), isNull(locations.mergedInto)];

  if (query.id) conditions.push(eq(locations.id, query.id));
  if (query.zone) conditions.push(eq(locations.zone, query.zone));
  if (query.q?.trim()) {
    const term = `%${query.q.trim()}%`;
    /*
     * Matched with EXISTS rather than against the joined `member` rows: a WHERE
     * on the join would drop non-matching members and silently lose their
     * reviews from the totals. This way searching a merged listing's name still
     * finds the store, with the aggregate intact.
     */
    conditions.push(sql`exists (
      select 1 from ${locations} m
      where coalesce(m.merged_into, m.id) = ${locations.id}
        and (m.name ilike ${term} or m.city ilike ${term} or m.address ilike ${term})
    )`);
  }

  /*
   * Self-join: every location rolls up to `coalesce(merged_into, id)`, so a
   * canonical row collects its own reviews plus those of anything merged into
   * it. Only canonical rows are returned, which is what stops a store that
   * has duplicate listings being listed and counted twice.
   */
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      city: locations.city,
      address: locations.address,
      zone: locations.zone,
      googleUrl: locations.googleUrl,
      total: sql<number>`count(${reviews.id})::int`,
      avg: sql<string | null>`avg(${reviews.rating})`,
      unanswered: sql<number>`count(${reviews.id}) filter (where ${reviews.status} in ('new','in_progress') and ${reviews.rating} <= ${REPLY_THRESHOLD})::int`,
      negativeUnanswered: sql<number>`count(${reviews.id}) filter (where ${reviews.status} in ('new','in_progress') and ${reviews.rating} <= 2)::int`,
      s1: sql<number>`count(${reviews.id}) filter (where ${reviews.rating} = 1)::int`,
      s2: sql<number>`count(${reviews.id}) filter (where ${reviews.rating} = 2)::int`,
      s3: sql<number>`count(${reviews.id}) filter (where ${reviews.rating} = 3)::int`,
      s4: sql<number>`count(${reviews.id}) filter (where ${reviews.rating} = 4)::int`,
      s5: sql<number>`count(${reviews.id}) filter (where ${reviews.rating} = 5)::int`,
      mergedFrom: sql<{ id: string; source: string; name: string }[]>`
        coalesce(
          jsonb_agg(distinct jsonb_build_object(
            'id', ${member.id}, 'source', ${member.source}, 'name', ${member.name}
          )) filter (where ${member.id} is not null and ${member.id} <> ${locations.id}),
          '[]'::jsonb
        )`,
    })
    .from(locations)
    .leftJoin(member, eq(sql`coalesce(${member.mergedInto}, ${member.id})`, locations.id))
    .leftJoin(reviews, eq(reviews.locationId, member.id))
    .where(and(...conditions))
    .groupBy(locations.id)
    .orderBy(
      query.sort === "backlog"
        ? desc(
            sql`count(${reviews.id}) filter (where ${reviews.status} in ('new','in_progress') and ${reviews.rating} <= ${REPLY_THRESHOLD})`,
          )
        : asc(sql`avg(${reviews.rating})`),
    );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: storeCode(r.name),
    city: r.city,
    address: r.address,
    zone: (isZoneId(r.zone) ? r.zone : "unassigned") as ZoneId,
    googleUrl: r.googleUrl,
    avgRating: r.avg ? Number(Number(r.avg).toFixed(2)) : null,
    totalReviews: r.total,
    unanswered: r.unanswered,
    negativeUnanswered: r.negativeUnanswered,
    histogram: [r.s1, r.s2, r.s3, r.s4, r.s5],
    mergedFrom: r.mergedFrom ?? [],
  }));
}

/**
 * One store's figures.
 *
 * Resolves the id to its canonical row first, then aggregates only that store.
 * This used to build the whole estate's table and pick one row out of it in JS,
 * which is free at a dozen shops and silly at a couple of hundred.
 */
export async function getStore(id: string): Promise<StoreStats | null> {
  // The id comes straight off the URL. Postgres raises on a malformed uuid, so
  // a junk path has to be a miss here rather than a 500 on the store page.
  if (!UUID_RE.test(id)) return null;

  const [row] = await db
    .select({ canonicalId: sql<string>`coalesce(${locations.mergedInto}, ${locations.id})` })
    .from(locations)
    .where(eq(locations.id, id));

  // Asked for a merged row — its canonical store is what has the numbers.
  if (!row) return null;

  const [store] = await getStoreStats({ id: row.canonicalId });
  return store ?? null;
}

/** Locations that can still be merged into something (canonical, not itself). */
export async function getMergeCandidates(excludeId: string) {
  return db
    .select({
      id: locations.id,
      name: locations.name,
      source: locations.source,
      city: locations.city,
      address: locations.address,
    })
    .from(locations)
    .where(and(isNull(locations.mergedInto), ne(locations.id, excludeId)))
    .orderBy(asc(locations.name));
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export type ZoneStats = {
  zone: ZoneId;
  storeCount: number;
  totalReviews: number;
  avgRating: number | null;
  unanswered: number;
  negativeUnanswered: number;
  /** Worst-rated store in the zone, for a "start here" hint. */
  worstStore: { id: string; name: string; avgRating: number | null } | null;
};

/**
 * Zone-level workload, ordered by backlog. This drives the overview: the point
 * is to answer "which area is falling behind", not "what is our average".
 */
export async function getZoneStats(): Promise<ZoneStats[]> {
  const stores = await getStoreStats();
  const byZone = new Map<ZoneId, StoreStats[]>();

  for (const store of stores) {
    const list = byZone.get(store.zone);
    if (list) list.push(store);
    else byZone.set(store.zone, [store]);
  }

  const zones: ZoneStats[] = [];

  for (const [zone, list] of byZone) {
    const totalReviews = list.reduce((sum, s) => sum + s.totalReviews, 0);
    // Weight each store's average by its review count, otherwise a store with
    // three reviews swings the zone as hard as one with three hundred.
    const weighted = list.reduce(
      (sum, s) => sum + (s.avgRating ?? 0) * s.totalReviews,
      0,
    );

    const rated = list.filter((s) => s.avgRating != null);
    const worst = rated.length
      ? rated.reduce((a, b) => (a.avgRating! <= b.avgRating! ? a : b))
      : null;

    zones.push({
      zone,
      storeCount: list.length,
      totalReviews,
      avgRating: totalReviews ? Number((weighted / totalReviews).toFixed(2)) : null,
      unanswered: list.reduce((sum, s) => sum + s.unanswered, 0),
      negativeUnanswered: list.reduce((sum, s) => sum + s.negativeUnanswered, 0),
      worstStore: worst
        ? { id: worst.id, name: worst.name, avgRating: worst.avgRating }
        : null,
    });
  }

  // Biggest backlog first; angry reviews break ties.
  return zones.sort(
    (a, b) =>
      b.unanswered - a.unanswered || b.negativeUnanswered - a.negativeUnanswered,
  );
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export type TopicStat = { topic: Topic; mentions: number; avgRating: number };

export async function getTopicStats(days = 90): Promise<TopicStat[]> {
  const rows = await db.execute<{
    topic: string;
    mentions: number;
    avg_rating: string;
  }>(sql`
    select unnest(topics) as topic,
           count(*)::int as mentions,
           avg(rating) as avg_rating
    from reviews
    where topics is not null
      and array_length(topics, 1) > 0
      and published_at >= now() - (${days} || ' days')::interval
    group by 1
    order by mentions desc
  `);

  return rows.rows.map((r) => ({
    topic: r.topic as Topic,
    mentions: r.mentions,
    avgRating: Number(Number(r.avg_rating).toFixed(2)),
  }));
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

/**
 * The worst rating that still earns a reply.
 *
 * A deliberate business decision, not a technical one: roughly two thirds of
 * everything customers write is 4- and 5-star praise, and answering all of it
 * buried the reviews that actually cost the chain something. At 3 the queue
 * holds everyone who was unhappy or lukewarm.
 *
 * Nothing is deleted or hidden by this — the happy reviews still count towards
 * every rating on the dashboard, and the "Everything" tab still lists them.
 * Raise it to 5 to go back to answering the lot.
 */
export const REPLY_THRESHOLD = 3;

/**
 * Three tabs, not five.
 *
 * "To answer" is the work. "Done" is what's been dealt with — replied or
 * skipped — which doubles as the record of what was actually sent. Sorting
 * already puts the angriest review at the top of the queue, so the old
 * "Negative" tab was doing a job the ordering does for free.
 */
export const INBOX_FILTERS = ["to_answer", "done", "all"] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export type InboxItem = {
  id: string;
  rating: number;
  text: string | null;
  authorName: string | null;
  publishedAt: Date;
  status: string;
  language: string | null;
  topics: string[] | null;
  storeName: string;
  storeCode: string;
  hasExistingReply: boolean;
  /** What was actually sent. Only loaded for the Done tab. */
  replyText?: string | null;
  /** Who sent it, snapshotted at the time. */
  replyOperator?: string | null;
  replyAt?: Date | null;
};

/**
 * Queue ordering. "worst" is the default because an angry review left
 * unanswered costs more than a five-star one, but a run of praise is
 * sometimes the faster way to clear a backlog — hence the choice.
 */
export const INBOX_SORTS = ["worst", "best", "newest", "oldest", "handled"] as const;
export type InboxSort = (typeof INBOX_SORTS)[number];

/** "handled" only makes sense on the Done tab, so it isn't offered elsewhere. */
export const QUEUE_SORTS = INBOX_SORTS.filter((s) => s !== "handled");

export type InboxQuery = {
  filter?: InboxFilter;
  locationId?: string;
  q?: string;
  sort?: InboxSort;
  limit?: number;
};

/**
 * How many rows the queue shows before asking. The window grows a page at a
 * time rather than paginating: the operator walks the queue with J/K, and a
 * page boundary that silently resets that walk is worse than a longer list.
 */
export const INBOX_PAGE_SIZE = 100;

/** Ceiling on the grown window, so one operator can't ask for the whole table. */
export const INBOX_MAX_WINDOW = 1000;

/**
 * Free-text match over the review, its author and the store name.
 *
 * `%` and `_` are escaped: an operator searching for "100%" means the string,
 * not a wildcard, and Postgres would otherwise read it as one.
 */
function searchCondition(q?: string) {
  const term = q?.trim();
  if (!term) return undefined;
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return or(
    ilike(reviews.text, like),
    ilike(reviews.authorName, like),
    ilike(locations.name, like),
  );
}

function filterCondition(filter: InboxFilter) {
  switch (filter) {
    case "to_answer":
      return and(
        inArray(reviews.status, ["new", "in_progress"]),
        lte(reviews.rating, REPLY_THRESHOLD),
      );
    case "done":
      return inArray(reviews.status, ["replied", "skipped"]);
    case "all":
      return undefined;
  }
}

function orderFor(sort: InboxSort) {
  switch (sort) {
    case "best":
      return [desc(reviews.rating), desc(reviews.publishedAt)];
    case "newest":
      return [desc(reviews.publishedAt)];
    case "oldest":
      return [asc(reviews.publishedAt)];
    // When it was dealt with, not when it was written.
    case "handled":
      return [desc(reviews.updatedAt)];
    case "worst":
    default:
      return [asc(reviews.rating), desc(reviews.publishedAt)];
  }
}

export async function getInbox(query: InboxQuery = {}): Promise<InboxItem[]> {
  const {
    filter = "to_answer",
    locationId,
    q,
    // Done is a record of what happened, so it reads most-recent-first unless
    // asked otherwise. The work queue reads worst-first.
    sort = filter === "done" ? "handled" : "worst",
    limit = INBOX_PAGE_SIZE,
  } = query;

  const conditions = [filterCondition(filter)];
  if (locationId) conditions.push(reviewsInStore(locationId));
  conditions.push(searchCondition(q));

  const where = conditions.filter(Boolean);

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      authorName: reviews.authorName,
      publishedAt: reviews.publishedAt,
      status: reviews.status,
      language: reviews.language,
      topics: reviews.topics,
      storeName: locations.name,
      existingReplyText: reviews.existingReplyText,
    })
    .from(reviews)
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(...orderFor(sort))
    .limit(Math.min(Math.max(limit, 1), INBOX_MAX_WINDOW));

  const items: InboxItem[] = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    authorName: r.authorName,
    publishedAt: r.publishedAt,
    status: r.status,
    language: r.language,
    topics: r.topics,
    storeName: r.storeName,
    storeCode: storeCode(r.storeName),
    hasExistingReply: Boolean(r.existingReplyText),
  }));

  /*
   * On the Done tab, attach what was actually sent. This is the record of past
   * replies — the operator's own words, who sent them and when — so it belongs
   * next to the review rather than on a separate history screen.
   *
   * Fetched as one extra query over just the rows on screen, and only for this
   * tab, so the working queue doesn't pay for it.
   */
  if (filter === "done" && items.length > 0) {
    const sent = await latestRepliesFor(items.map((item) => item.id));
    for (const item of items) {
      const reply = sent.get(item.id);
      item.replyText = reply?.text ?? null;
      item.replyOperator = reply?.operator ?? null;
      item.replyAt = reply?.createdAt ?? null;
    }
  }

  return items;
}

/**
 * The most recent reply per review, for a set of reviews. DISTINCT ON is
 * Postgres's "one row per group" — cheaper here than a window function or a
 * round trip per review.
 */
async function latestRepliesFor(reviewIds: string[]) {
  const rows = await db
    .selectDistinctOn([replies.reviewId], {
      reviewId: replies.reviewId,
      text: replies.text,
      operator: replies.operator,
      createdAt: replies.createdAt,
    })
    .from(replies)
    .where(inArray(replies.reviewId, reviewIds))
    .orderBy(replies.reviewId, desc(replies.createdAt));

  return new Map(rows.map((r) => [r.reviewId, r]));
}

/**
 * Totals per filter, used for the filter chips and to decide whether the queue
 * has more rows than it is showing.
 *
 * Takes the same search term as getInbox on purpose: these numbers sit directly
 * above the list, and a chip counting rows the list isn't allowed to show is
 * just a lie about the queue.
 */
export async function countInboxByFilter(locationId?: string, q?: string) {
  const conditions = [
    locationId ? reviewsInStore(locationId) : undefined,
    searchCondition(q),
  ].filter(Boolean);

  const [row] = await db
    .select({
      to_answer: sql<number>`count(*) filter (where ${reviews.status} in ('new','in_progress') and ${reviews.rating} <= ${REPLY_THRESHOLD})::int`,
      done: sql<number>`count(*) filter (where ${reviews.status} in ('replied','skipped'))::int`,
      all: sql<number>`count(*)::int`,
    })
    // Joined because the search term matches on the store name too. Every
    // review has a location (the column is NOT NULL), so this never drops rows.
    .from(reviews)
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .where(conditions.length ? and(...conditions) : undefined);

  return row ?? { to_answer: 0, done: 0, all: 0 };
}

// ---------------------------------------------------------------------------
// Single review
// ---------------------------------------------------------------------------

/**
 * The individual stores carrying the biggest unanswered queues.
 *
 * Sorted here rather than in SQL so this shares the cached no-argument
 * aggregate with the zone rollup — the dashboard wants both, and they were
 * running the same expensive query twice for want of a different ORDER BY.
 */
export async function getBacklogStores(limit = 6): Promise<StoreStats[]> {
  const stores = await getStoreStats();
  return stores
    .filter((s) => s.unanswered > 0)
    .sort((a, b) => b.unanswered - a.unanswered || b.negativeUnanswered - a.negativeUnanswered)
    .slice(0, limit);
}

export type ReviewDetail = {
  id: string;
  /** Which adapter produced it — decides whether it can be published back. */
  source: string;
  rating: number;
  text: string | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  publishedAt: Date;
  status: string;
  language: string | null;
  topics: string[] | null;
  existingReplyText: string | null;
  store: { id: string; name: string; code: string; city: string | null; googleUrl: string | null };
  suggestions: {
    id: string;
    tone: string;
    text: string;
    model: string;
    generationId: string;
  }[];
  reply: { text: string; createdAt: Date } | null;
};

export async function getReviewDetail(id: string): Promise<ReviewDetail | null> {
  const [row] = await db
    .select({ review: reviews, location: locations })
    .from(reviews)
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .where(eq(reviews.id, id));

  if (!row) return null;

  const allSuggestions = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.reviewId, id))
    .orderBy(desc(suggestions.createdAt));

  const newest = allSuggestions[0]?.generationId;
  const batch = allSuggestions.filter((s) => s.generationId === newest);

  const [reply] = await db
    .select()
    .from(replies)
    .where(eq(replies.reviewId, id))
    .orderBy(desc(replies.createdAt))
    .limit(1);

  return {
    id: row.review.id,
    source: row.review.source,
    rating: row.review.rating,
    text: row.review.text,
    authorName: row.review.authorName,
    authorPhotoUrl: row.review.authorPhotoUrl,
    publishedAt: row.review.publishedAt,
    status: row.review.status,
    language: row.review.language,
    topics: row.review.topics,
    existingReplyText: row.review.existingReplyText,
    store: {
      id: row.location.id,
      name: row.location.name,
      code: storeCode(row.location.name),
      city: row.location.city,
      googleUrl: row.location.googleUrl,
    },
    suggestions: batch.map((s) => ({
      id: s.id,
      tone: s.tone,
      text: s.text,
      model: s.model,
      generationId: s.generationId,
    })),
    reply: reply ? { text: reply.text, createdAt: reply.createdAt } : null,
  };
}

// ---------------------------------------------------------------------------
// Store detail extras
// ---------------------------------------------------------------------------

export async function getRecentReviewsForStore(locationId: string, limit = 12) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      text: reviews.text,
      authorName: reviews.authorName,
      publishedAt: reviews.publishedAt,
      status: reviews.status,
      source: reviews.source,
    })
    .from(reviews)
    .where(reviewsInStore(locationId))
    .orderBy(desc(reviews.publishedAt))
    .limit(limit);
}

/** Monthly average for the last `months` months, oldest first. */
export async function getStoreTrend(locationId: string, months = 6) {
  const since = new Date(Date.now() - months * 30 * DAY_MS);
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${reviews.publishedAt}), 'YYYY-MM')`,
      avg: sql<string>`avg(${reviews.rating})`,
      total: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(reviewsInStore(locationId), gte(reviews.publishedAt, since)))
    .groupBy(sql`date_trunc('month', ${reviews.publishedAt})`)
    .orderBy(asc(sql`date_trunc('month', ${reviews.publishedAt})`));

  return rows.map((r) => ({
    month: r.month,
    avg: Number(Number(r.avg).toFixed(2)),
    total: r.total,
  }));
}

/**
 * Replies sent today, across the desk.
 *
 * Counted from `replies` rather than from review status, so it means "work you
 * did today" — a review Google already had an answer to, or one that was
 * skipped, doesn't flatter the number.
 *
 * Deliberately a plain count rather than progress towards a target. A bar
 * filling towards 20 invents a goal nobody set; a number that went up because
 * you answered something is just true.
 */
export async function getRepliedToday(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(replies)
    .where(sql`${replies.createdAt} >= date_trunc('day', now())`);

  return row?.n ?? 0;
}

export async function getRecentSyncs(limit = 8) {
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
}

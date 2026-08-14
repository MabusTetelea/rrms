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
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { locations, replies, reviews, suggestions, syncRuns } from "@/db/schema";

/** Second reference to `locations` for the merge self-join. */
const member = alias(locations, "member");
import { storeCode } from "@/lib/format";
import type { Topic } from "@/lib/text";
import { isZoneId, type ZoneId } from "@/lib/zones";

const DAY_MS = 86_400_000;

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
      unanswered: sql<number>`count(*) filter (where ${reviews.status} in ('new','in_progress'))::int`,
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
  /** Other source rows folded into this one, e.g. the Yandex twin. */
  mergedFrom: { id: string; source: string; name: string }[];
};

export type StoreQuery = {
  /** Free text over store name, city and address. */
  q?: string;
  zone?: ZoneId;
  /** "rating" = worst rated first (default), "backlog" = biggest queue first. */
  sort?: "rating" | "backlog";
};

export async function getStoreStats(query: StoreQuery = {}): Promise<StoreStats[]> {
  // Canonical rows only — merged ones are folded in below.
  const conditions = [eq(locations.active, true), isNull(locations.mergedInto)];

  if (query.zone) conditions.push(eq(locations.zone, query.zone));
  if (query.q?.trim()) {
    const term = `%${query.q.trim()}%`;
    /*
     * Matched with EXISTS rather than against the joined `member` rows: a WHERE
     * on the join would drop non-matching members and silently lose their
     * reviews from the totals. This way searching the Yandex name still finds
     * the store, with the aggregate intact.
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
   * exists on both Google and Yandex being listed and counted twice.
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
      unanswered: sql<number>`count(${reviews.id}) filter (where ${reviews.status} in ('new','in_progress'))::int`,
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
            sql`count(${reviews.id}) filter (where ${reviews.status} in ('new','in_progress'))`,
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

export async function getStore(id: string): Promise<StoreStats | null> {
  const all = await getStoreStats();
  const direct = all.find((s) => s.id === id);
  if (direct) return direct;
  // Asked for a merged row — show the canonical store it belongs to.
  return all.find((s) => s.mergedFrom.some((m) => m.id === id)) ?? null;
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

export const INBOX_FILTERS = [
  "unanswered",
  "negative",
  "replied",
  "skipped",
  "all",
] as const;
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
};

/**
 * Queue ordering. "worst" is the default because an angry review left
 * unanswered costs more than a five-star one, but a run of praise is
 * sometimes the faster way to clear a backlog — hence the choice.
 */
export const INBOX_SORTS = ["worst", "best", "newest", "oldest"] as const;
export type InboxSort = (typeof INBOX_SORTS)[number];

export type InboxQuery = {
  filter?: InboxFilter;
  locationId?: string;
  q?: string;
  sort?: InboxSort;
  limit?: number;
};

function filterCondition(filter: InboxFilter) {
  switch (filter) {
    case "unanswered":
      return inArray(reviews.status, ["new", "in_progress"]);
    case "negative":
      return and(
        inArray(reviews.status, ["new", "in_progress"]),
        sql`${reviews.rating} <= 2`,
      );
    case "replied":
      return eq(reviews.status, "replied");
    case "skipped":
      return eq(reviews.status, "skipped");
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
    case "worst":
    default:
      return [asc(reviews.rating), desc(reviews.publishedAt)];
  }
}

export async function getInbox(query: InboxQuery = {}): Promise<InboxItem[]> {
  const { filter = "unanswered", locationId, q, sort = "worst", limit = 200 } = query;

  const conditions = [filterCondition(filter)];
  if (locationId) conditions.push(reviewsInStore(locationId));
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    conditions.push(
      or(ilike(reviews.text, term), ilike(reviews.authorName, term), ilike(locations.name, term)),
    );
  }

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
    .limit(limit);

  return rows.map((r) => ({
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
}

export async function countInboxByFilter(locationId?: string) {
  const base = locationId ? reviewsInStore(locationId) : undefined;

  const [row] = await db
    .select({
      unanswered: sql<number>`count(*) filter (where ${reviews.status} in ('new','in_progress'))::int`,
      negative: sql<number>`count(*) filter (where ${reviews.status} in ('new','in_progress') and ${reviews.rating} <= 2)::int`,
      replied: sql<number>`count(*) filter (where ${reviews.status} = 'replied')::int`,
      skipped: sql<number>`count(*) filter (where ${reviews.status} = 'skipped')::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(base);

  return row ?? { unanswered: 0, negative: 0, replied: 0, skipped: 0, all: 0 };
}

// ---------------------------------------------------------------------------
// Single review
// ---------------------------------------------------------------------------

/** The individual stores carrying the biggest unanswered queues. */
export async function getBacklogStores(limit = 6): Promise<StoreStats[]> {
  const stores = await getStoreStats({ sort: "backlog" });
  return stores.filter((s) => s.unanswered > 0).slice(0, limit);
}

export type ReviewDetail = {
  id: string;
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

export async function getRecentSyncs(limit = 8) {
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
}

import { and, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { locations, reviews, syncRuns } from "@/db/schema";
import { getReviewSource } from "@/lib/sources";
import type { SourceLocation } from "@/lib/sources";
import { detectLanguage, extractTopics, sentimentFromRating } from "@/lib/text";
import { resolveZone } from "@/lib/zones";

export type SyncResult = {
  runId: string;
  source: string;
  locationsUpserted: number;
  reviewsUpserted: number;
  reviewsNew: number;
};

/**
 * Pull locations and reviews from the configured source into Postgres.
 *
 * Re-running is safe: rows are keyed on (source, external_id), and an update
 * only touches fields the provider owns. Operator state — status, and the
 * replies/suggestions hanging off a review — is never overwritten by a sync.
 */
export async function runSync(options: { full?: boolean } = {}): Promise<SyncResult> {
  const source = getReviewSource();

  if (!source.isConfigured()) {
    throw new Error(
      `Review source "${source.name}" is not configured. ${source.configHint}`,
    );
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ source: source.name })
    .returning({ id: syncRuns.id });

  try {
    const sourceLocations = await source.listLocations();
    const locationIdByExternal = new Map<string, string>();

    for (const loc of sourceLocations) {
      const [row] = await db
        .insert(locations)
        .values({
          source: source.name,
          externalId: loc.externalId,
          name: loc.name,
          address: loc.address ?? null,
          city: loc.city ?? null,
          zone: resolveZone(loc),
          lat: loc.lat != null ? String(loc.lat) : null,
          lng: loc.lng != null ? String(loc.lng) : null,
          googleUrl: loc.googleUrl ?? null,
          reportedRating: loc.reportedRating != null ? String(loc.reportedRating) : null,
          reportedReviewCount: loc.reportedReviewCount ?? null,
        })
        .onConflictDoUpdate({
          target: [locations.source, locations.externalId],
          set: {
            name: sql`excluded.name`,
            address: sql`excluded.address`,
            city: sql`excluded.city`,
            zone: sql`excluded.zone`,
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            googleUrl: sql`excluded.google_url`,
            reportedRating: sql`excluded.reported_rating`,
            reportedReviewCount: sql`excluded.reported_review_count`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: locations.id });

      locationIdByExternal.set(loc.externalId, row.id);
    }

    let reviewsUpserted = 0;
    let reviewsNew = 0;

    for (const loc of sourceLocations) {
      const locationId = locationIdByExternal.get(loc.externalId)!;
      const since = options.full ? undefined : await newestReviewDate(locationId);
      const fetched = await source.fetchReviews(loc satisfies SourceLocation, since);
      if (fetched.length === 0) continue;

      // Split into new vs. already-known so the run summary is meaningful.
      const externalIds = fetched.map((r) => r.externalId);
      const known = new Set(
        (
          await db
            .select({ externalId: reviews.externalId })
            .from(reviews)
            .where(
              and(
                eq(reviews.source, source.name),
                inArray(reviews.externalId, externalIds),
              ),
            )
        ).map((r) => r.externalId),
      );

      const values = fetched.map((rev) => ({
        locationId,
        source: source.name,
        externalId: rev.externalId,
        authorName: rev.authorName ?? null,
        authorPhotoUrl: rev.authorPhotoUrl ?? null,
        rating: rev.rating,
        text: rev.text ?? null,
        language: detectLanguage(rev.text),
        publishedAt: rev.publishedAt,
        existingReplyText: rev.existingReplyText ?? null,
        existingReplyAt: rev.existingReplyAt ?? null,
        // A review Google already shows a reply to needs no operator work.
        status: rev.existingReplyText ? ("replied" as const) : ("new" as const),
        sentiment: sentimentFromRating(rev.rating),
        topics: extractTopics(rev.text),
      }));

      // Chunked so a store with thousands of reviews doesn't blow the parameter limit.
      for (let i = 0; i < values.length; i += 250) {
        await db
          .insert(reviews)
          .values(values.slice(i, i + 250))
          .onConflictDoUpdate({
            target: [reviews.source, reviews.externalId],
            set: {
              // Authors can edit their review, and owners can reply on Google
              // directly — both need to flow back in. `status` stays untouched.
              text: sql`excluded.text`,
              rating: sql`excluded.rating`,
              language: sql`excluded.language`,
              topics: sql`excluded.topics`,
              sentiment: sql`excluded.sentiment`,
              existingReplyText: sql`excluded.existing_reply_text`,
              existingReplyAt: sql`excluded.existing_reply_at`,
              updatedAt: new Date(),
            },
          });
      }

      reviewsUpserted += values.length;
      reviewsNew += values.filter((v) => !known.has(v.externalId)).length;
    }

    await db
      .update(syncRuns)
      .set({
        status: "ok",
        finishedAt: new Date(),
        locationsUpserted: sourceLocations.length,
        reviewsUpserted,
        reviewsNew,
      })
      .where(eq(syncRuns.id, run.id));

    return {
      runId: run.id,
      source: source.name,
      locationsUpserted: sourceLocations.length,
      reviewsUpserted,
      reviewsNew,
    };
  } catch (err) {
    await db
      .update(syncRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(syncRuns.id, run.id));
    throw err;
  }
}

async function newestReviewDate(locationId: string): Promise<Date | undefined> {
  const [row] = await db
    .select({ newest: max(reviews.publishedAt) })
    .from(reviews)
    .where(eq(reviews.locationId, locationId));
  return row?.newest ?? undefined;
}

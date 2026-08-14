import type { ReviewSource, SourceLocation, SourceReview } from "./types";

/**
 * Yandex Maps reviews.
 *
 * There is no official Yandex reviews API — Yandex Business shows reviews in
 * its own dashboard and offers an embeddable widget, but exposes no public read
 * endpoint. So this goes through Apify's maintained scraper actor.
 *
 * Read-only, like every source here: replies are still pasted into Yandex
 * Business by hand.
 *
 * Configure with APIFY_TOKEN plus YANDEX_START_URLS (Yandex Maps org URLs) or
 * YANDEX_BUSINESS_IDS.
 */

const ACTOR = "zen-studio~yandex-maps-reviews-scraper";
const RUN_SYNC = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`;

type ApifyReview = {
  businessId?: string | number;
  businessTitle?: string;
  businessUrl?: string;
  businessAddress?: string;
  businessRating?: number;
  reviewId?: string;
  rating?: number;
  text?: string;
  date?: string;
  businessComment?: string;
  businessCommentDate?: string;
  authorName?: string;
  authorAvatarUrl?: string;
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Best-effort city from a Yandex address string ("Молдова, Кишинёв, ул. ..."). */
function cityFromAddress(address?: string): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim());
  return parts.length >= 2 ? parts[1] : null;
}

export class YandexSource implements ReviewSource {
  readonly name = "yandex";
  readonly configHint =
    "Set APIFY_TOKEN, plus YANDEX_START_URLS or YANDEX_BUSINESS_IDS. Yandex has no official reviews API, so this runs through Apify.";

  /**
   * One actor run covers every configured business, so results are fetched
   * once per sync and served to both interface methods from here. Running the
   * scraper per location would mean one paid run per store.
   */
  private loaded: {
    locations: SourceLocation[];
    reviewsByBusiness: Map<string, SourceReview[]>;
  } | null = null;

  private get token() {
    return process.env.APIFY_TOKEN ?? "";
  }

  isConfigured() {
    const hasTarget = Boolean(
      process.env.YANDEX_START_URLS?.trim() || process.env.YANDEX_BUSINESS_IDS?.trim(),
    );
    return this.token.length > 0 && hasTarget;
  }

  private async load() {
    if (this.loaded) return this.loaded;

    const startUrls = (process.env.YANDEX_START_URLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

    const businessIds = (process.env.YANDEX_BUSINESS_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const input = {
      ...(startUrls.length ? { startUrls } : {}),
      ...(businessIds.length ? { businessIds } : {}),
      maxReviewsPerPlace: Number(process.env.YANDEX_REVIEWS_LIMIT ?? 500),
      maxPlaces: 0,
      reviewSort: "newest",
      language: process.env.YANDEX_LANGUAGE ?? "ru",
    };

    const url = new URL(RUN_SYNC);
    url.searchParams.set("token", this.token);
    // The run-sync endpoint caps out around five minutes.
    url.searchParams.set("timeout", "300");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(320_000),
    });

    if (!res.ok) {
      throw new Error(
        `Apify Yandex actor failed: ${res.status} ${(await res.text()).slice(0, 400)}`,
      );
    }

    const rows = (await res.json()) as ApifyReview[];

    const locations = new Map<string, SourceLocation>();
    const reviewsByBusiness = new Map<string, SourceReview[]>();

    /*
     * The actor emits a flat list where business context is only populated on
     * the first row of each business, so carry the last seen values forward.
     */
    let currentBusinessId: string | null = null;

    for (const row of rows) {
      if (row.businessId != null && String(row.businessId).trim()) {
        currentBusinessId = String(row.businessId);
      }
      if (!currentBusinessId) continue;

      if (!locations.has(currentBusinessId) && row.businessTitle) {
        locations.set(currentBusinessId, {
          externalId: currentBusinessId,
          name: row.businessTitle,
          address: row.businessAddress ?? null,
          city: cityFromAddress(row.businessAddress),
          googleUrl: row.businessUrl ?? null,
          reportedRating: row.businessRating ?? null,
        });
      }

      const publishedAt = parseDate(row.date);
      // A review with no id or no date can't be deduplicated or ordered.
      if (!row.reviewId || !row.rating || !publishedAt) continue;

      const list = reviewsByBusiness.get(currentBusinessId) ?? [];
      list.push({
        externalId: row.reviewId,
        locationExternalId: currentBusinessId,
        authorName: row.authorName ?? null,
        authorPhotoUrl: row.authorAvatarUrl ?? null,
        rating: row.rating,
        text: row.text?.trim() || null,
        publishedAt,
        existingReplyText: row.businessComment?.trim() || null,
        existingReplyAt: parseDate(row.businessCommentDate),
      });
      reviewsByBusiness.set(currentBusinessId, list);
    }

    this.loaded = { locations: [...locations.values()], reviewsByBusiness };
    return this.loaded;
  }

  async listLocations(): Promise<SourceLocation[]> {
    return (await this.load()).locations;
  }

  async fetchReviews(location: SourceLocation, since?: Date): Promise<SourceReview[]> {
    const { reviewsByBusiness } = await this.load();
    const all = reviewsByBusiness.get(location.externalId) ?? [];
    if (!since) return all;
    return all.filter((review) => review.publishedAt > since);
  }
}

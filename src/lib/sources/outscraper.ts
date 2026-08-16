import { companyName } from "@/lib/company";
import type { ReviewSource, SourceLocation, SourceReview } from "./types";

/**
 * Outscraper (https://outscraper.com) — returns full Google review history for
 * any place without owning the listing. Read-only: replies must still be pasted
 * into Google Business Profile by hand, which is how this app works anyway.
 *
 * Locations are either listed explicitly via OUTSCRAPER_PLACE_IDS, or
 * discovered by running a Maps search for OUTSCRAPER_SEARCH_QUERY.
 */

const API = "https://api.outscraper.cloud";

type OutscraperPlace = {
  place_id?: string;
  google_id?: string;
  name?: string;
  full_address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  location_link?: string;
  rating?: number;
  reviews?: number;
  reviews_data?: OutscraperReview[];
};

type OutscraperReview = {
  review_id?: string;
  author_title?: string;
  author_image?: string;
  review_text?: string;
  review_rating?: number;
  review_datetime_utc?: string;
  review_timestamp?: number;
  owner_answer?: string;
  owner_answer_timestamp?: number;
};

function parseDate(iso?: string, epochSeconds?: number): Date {
  if (epochSeconds) return new Date(epochSeconds * 1000);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function toLocation(place: OutscraperPlace): SourceLocation | null {
  const externalId = place.place_id ?? place.google_id;
  if (!externalId || !place.name) return null;
  return {
    externalId,
    name: place.name,
    address: place.full_address ?? null,
    city: place.city ?? null,
    lat: place.latitude ?? null,
    lng: place.longitude ?? null,
    googleUrl: place.location_link ?? null,
    reportedRating: place.rating ?? null,
    reportedReviewCount: place.reviews ?? null,
  };
}

export class OutscraperSource implements ReviewSource {
  readonly name = "outscraper";
  readonly configHint =
    "Set OUTSCRAPER_API_KEY, plus OUTSCRAPER_PLACE_IDS or OUTSCRAPER_SEARCH_QUERY.";

  private get key() {
    return process.env.OUTSCRAPER_API_KEY ?? "";
  }

  isConfigured() {
    return this.key.length > 0;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url, {
      headers: { "X-API-KEY": this.key },
      // Outscraper synchronous requests can take a while on big review sets.
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      throw new Error(`Outscraper ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async listLocations(): Promise<SourceLocation[]> {
    const explicit = (process.env.OUTSCRAPER_PLACE_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Explicit ids still need a metadata lookup to get names and addresses.
    const query = explicit.length
      ? explicit.join("\n")
      : process.env.OUTSCRAPER_SEARCH_QUERY || companyName() || "supermarket";

    const body = await this.request<{ data: OutscraperPlace[][] | OutscraperPlace[] }>(
      "/maps/search-v3",
      {
        query,
        limit: process.env.OUTSCRAPER_LIMIT ?? "200",
        async: "false",
      },
    );

    // The endpoint nests one result array per query line.
    const flat: OutscraperPlace[] = Array.isArray(body.data[0])
      ? (body.data as OutscraperPlace[][]).flat()
      : (body.data as OutscraperPlace[]);

    // A broad brand search also catches unrelated places. With no COMPANY_NAME
    // configured there's nothing to match on, so nothing is filtered out.
    const brand = companyName().toLowerCase();

    return flat
      .map(toLocation)
      .filter((l): l is SourceLocation => l !== null)
      .filter((l) => !brand || l.name.toLowerCase().includes(brand));
  }

  async fetchReviews(location: SourceLocation, since?: Date): Promise<SourceReview[]> {
    const body = await this.request<{ data: OutscraperPlace[] }>("/maps/reviews-v3", {
      query: location.externalId,
      reviewsLimit: process.env.OUTSCRAPER_REVIEWS_LIMIT ?? "500",
      sort: "newest",
      async: "false",
      ...(since ? { cutoff: String(Math.floor(since.getTime() / 1000)) } : {}),
    });

    const place = body.data?.[0];
    const rows = place?.reviews_data ?? [];

    return rows
      .filter((rev) => rev.review_id && rev.review_rating)
      .map((rev) => ({
        externalId: rev.review_id!,
        locationExternalId: location.externalId,
        authorName: rev.author_title ?? null,
        authorPhotoUrl: rev.author_image ?? null,
        rating: rev.review_rating!,
        text: rev.review_text?.trim() || null,
        publishedAt: parseDate(rev.review_datetime_utc, rev.review_timestamp),
        existingReplyText: rev.owner_answer?.trim() || null,
        existingReplyAt: rev.owner_answer_timestamp
          ? new Date(rev.owner_answer_timestamp * 1000)
          : null,
      }));
  }
}

import { companyName } from "@/lib/company";
import type { ReviewSource, SourceLocation, SourceReview } from "./types";

/**
 * SerpAPI (https://serpapi.com) — cheaper than Outscraper but paginated and
 * capped in practice, so it suits "keep up with new reviews" better than
 * "backfill five years of history". Read-only.
 *
 * Locations come from a Maps search; SERPAPI_PLACE_IDS narrows it if you'd
 * rather pin an exact set.
 */

const API = "https://serpapi.com/search.json";

type SerpPlace = {
  place_id?: string;
  data_id?: string;
  title?: string;
  address?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  rating?: number;
  reviews?: number;
  link?: string;
};

type SerpReview = {
  review_id?: string;
  user?: { name?: string; thumbnail?: string };
  rating?: number;
  snippet?: string;
  iso_date?: string;
  date?: string;
  response?: { snippet?: string; iso_date?: string };
};

export class SerpApiSource implements ReviewSource {
  readonly name = "serpapi";
  readonly configHint = "Set SERPAPI_API_KEY (and optionally SERPAPI_PLACE_IDS).";

  private get key() {
    return process.env.SERPAPI_API_KEY ?? "";
  }

  isConfigured() {
    return this.key.length > 0;
  }

  private async request<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(API);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("api_key", this.key);

    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`SerpAPI failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async listLocations(): Promise<SourceLocation[]> {
    const explicit = (process.env.SERPAPI_PLACE_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const found: SourceLocation[] = [];
    /*
     * A Maps search for a chain also returns whatever else sits nearby, so
     * results are kept only when the name carries the brand. With no
     * COMPANY_NAME configured there is nothing to match on, and everything the
     * search returned is kept rather than silently discarding all of it.
     */
    const brand = companyName().toLowerCase();

    // Maps search returns 20 per page; walk until the chain's stores run out.
    for (let start = 0; start < 200; start += 20) {
      const body = await this.request<{ local_results?: SerpPlace[] }>({
        engine: "google_maps",
        q: process.env.SERPAPI_SEARCH_QUERY || companyName() || "supermarket",
        // Chișinău centre, zoom out far enough to cover the country.
        ll: process.env.SERPAPI_LL ?? "@47.0105,28.8638,9z",
        type: "search",
        start: String(start),
      });

      const page = body.local_results ?? [];
      if (page.length === 0) break;

      for (const place of page) {
        const externalId = place.place_id ?? place.data_id;
        if (!externalId || !place.title) continue;
        if (brand && !place.title.toLowerCase().includes(brand)) continue;
        if (explicit.length && !explicit.includes(externalId)) continue;
        found.push({
          externalId,
          name: place.title,
          address: place.address ?? null,
          city: place.address?.split(",").pop()?.trim() ?? null,
          lat: place.gps_coordinates?.latitude ?? null,
          lng: place.gps_coordinates?.longitude ?? null,
          googleUrl: place.link ?? null,
          reportedRating: place.rating ?? null,
          reportedReviewCount: place.reviews ?? null,
        });
      }
    }
    return found;
  }

  async fetchReviews(location: SourceLocation, since?: Date): Promise<SourceReview[]> {
    const out: SourceReview[] = [];
    let nextPageToken: string | undefined;

    for (let page = 0; page < 10; page++) {
      const body = await this.request<{
        reviews?: SerpReview[];
        serpapi_pagination?: { next_page_token?: string };
      }>({
        engine: "google_maps_reviews",
        place_id: location.externalId,
        sort_by: "newestFirst",
        ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
      });

      const rows = body.reviews ?? [];
      if (rows.length === 0) break;

      let reachedKnown = false;
      for (const rev of rows) {
        if (!rev.review_id || !rev.rating) continue;
        const publishedAt = rev.iso_date ? new Date(rev.iso_date) : new Date();
        // Sorted newest-first, so the first already-known review ends the walk.
        if (since && publishedAt <= since) {
          reachedKnown = true;
          break;
        }
        out.push({
          externalId: rev.review_id,
          locationExternalId: location.externalId,
          authorName: rev.user?.name ?? null,
          authorPhotoUrl: rev.user?.thumbnail ?? null,
          rating: rev.rating,
          text: rev.snippet?.trim() || null,
          publishedAt,
          existingReplyText: rev.response?.snippet?.trim() || null,
          existingReplyAt: rev.response?.iso_date
            ? new Date(rev.response.iso_date)
            : null,
        });
      }

      nextPageToken = body.serpapi_pagination?.next_page_token;
      if (reachedKnown || !nextPageToken) break;
    }

    return out;
  }
}

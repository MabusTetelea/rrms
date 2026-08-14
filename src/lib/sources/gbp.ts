import type { ReviewSource, SourceLocation, SourceReview } from "./types";

/**
 * Google Business Profile — free and complete, but only if the Google account
 * behind the refresh token actually manages the Linella listings, and Google
 * has approved your project for the Business Profile APIs.
 *
 * Auth is the offline refresh-token flow: run the consent screen once with
 * scope https://www.googleapis.com/auth/business.manage, keep the refresh
 * token, and this adapter mints access tokens from it.
 */

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_API = "https://mybusiness.googleapis.com/v4";

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

type GbpLocation = {
  /** "locations/12345678901234567890" */
  name?: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
  };
  latlng?: { latitude?: number; longitude?: number };
  metadata?: { mapsUri?: string };
};

type GbpReview = {
  reviewId?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

export class GbpSource implements ReviewSource {
  readonly name = "gbp";
  readonly configHint =
    "Set GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN and GBP_ACCOUNT_ID.";

  private token: { value: string; expiresAt: number } | null = null;

  isConfigured() {
    return Boolean(
      process.env.GBP_CLIENT_ID &&
        process.env.GBP_CLIENT_SECRET &&
        process.env.GBP_REFRESH_TOKEN &&
        process.env.GBP_ACCOUNT_ID,
    );
  }

  private async accessToken(): Promise<string> {
    // Reuse until a minute before expiry.
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }

    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GBP_CLIENT_ID!,
        client_secret: process.env.GBP_CLIENT_SECRET!,
        refresh_token: process.env.GBP_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      throw new Error(`GBP token refresh failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return this.token.value;
  }

  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.accessToken()}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`GBP request failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async listLocations(): Promise<SourceLocation[]> {
    const account = process.env.GBP_ACCOUNT_ID!;
    const out: SourceLocation[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${INFO_API}/accounts/${account}/locations`);
      url.searchParams.set(
        "readMask",
        "name,title,storefrontAddress,latlng,metadata",
      );
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const body = await this.get<{
        locations?: GbpLocation[];
        nextPageToken?: string;
      }>(url.toString());

      for (const loc of body.locations ?? []) {
        if (!loc.name || !loc.title) continue;
        // Store the bare id; the v4 reviews endpoint wants it without the prefix.
        const externalId = loc.name.replace(/^locations\//, "");
        out.push({
          externalId,
          name: loc.title,
          address: loc.storefrontAddress?.addressLines?.join(", ") ?? null,
          city: loc.storefrontAddress?.locality ?? null,
          lat: loc.latlng?.latitude ?? null,
          lng: loc.latlng?.longitude ?? null,
          googleUrl: loc.metadata?.mapsUri ?? null,
        });
      }

      pageToken = body.nextPageToken;
    } while (pageToken);

    return out;
  }

  async fetchReviews(location: SourceLocation, since?: Date): Promise<SourceReview[]> {
    const account = process.env.GBP_ACCOUNT_ID!;
    const out: SourceReview[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(
        `${REVIEWS_API}/accounts/${account}/locations/${location.externalId}/reviews`,
      );
      url.searchParams.set("pageSize", "50");
      url.searchParams.set("orderBy", "updateTime desc");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const body = await this.get<{
        reviews?: GbpReview[];
        nextPageToken?: string;
      }>(url.toString());

      const rows = body.reviews ?? [];
      if (rows.length === 0) break;

      let reachedKnown = false;
      for (const rev of rows) {
        const rating = STAR_VALUES[rev.starRating ?? ""];
        if (!rev.reviewId || !rating) continue;

        const publishedAt = new Date(rev.createTime ?? rev.updateTime ?? Date.now());
        if (since && publishedAt <= since) {
          reachedKnown = true;
          break;
        }

        out.push({
          externalId: rev.reviewId,
          locationExternalId: location.externalId,
          authorName: rev.reviewer?.displayName ?? null,
          authorPhotoUrl: rev.reviewer?.profilePhotoUrl ?? null,
          rating,
          text: rev.comment?.trim() || null,
          publishedAt,
          existingReplyText: rev.reviewReply?.comment?.trim() || null,
          existingReplyAt: rev.reviewReply?.updateTime
            ? new Date(rev.reviewReply.updateTime)
            : null,
        });
      }

      pageToken = body.nextPageToken;
      if (reachedKnown) break;
    } while (pageToken);

    return out;
  }
}

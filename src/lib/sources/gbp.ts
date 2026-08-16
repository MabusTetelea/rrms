import type { ReplyCapableSource, SourceLocation, SourceReview } from "./types";

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

export class GbpSource implements ReplyCapableSource {
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

  /**
   * Publishing is a separate switch from reading. Credentials alone aren't
   * enough of a reason to start writing to a public profile.
   */
  canPublish() {
    return this.isConfigured() && process.env.PUBLISH_REPLIES === "true";
  }

  /**
   * PUT .../reviews/{reviewId}/reply — creates the reply, or replaces it if one
   * already exists (Google models an edit as an overwrite). Google rejects this
   * for locations that aren't verified in Business Profile, which surfaces here
   * as a 403 with that reason in the body.
   */
  async postReply(input: {
    locationExternalId: string;
    reviewExternalId: string;
    text: string;
  }): Promise<void> {
    if (!this.canPublish()) {
      throw new Error(
        "Publishing to Google is off. Set PUBLISH_REPLIES=true and configure the GBP credentials.",
      );
    }

    const account = process.env.GBP_ACCOUNT_ID!;
    const url =
      `${REVIEWS_API}/accounts/${account}` +
      `/locations/${input.locationExternalId}` +
      `/reviews/${input.reviewExternalId}/reply`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: input.text }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(
        `Google rejected the reply (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    }
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

        /*
         * The watermark has to be compared against the field the page is
         * ordered by. This used to compare createTime while ordering by
         * updateTime, so a single old review that had been edited — or that
         * the owner had replied to — sorted to the top of the first page and
         * ended the entire scan, taking every genuinely new review below it.
         *
         * `since` is the newest publishedAt we hold, which is never later than
         * the newest updateTime, so this errs toward re-fetching. Upserts are
         * keyed on (source, external_id), so the cost of overlap is a few
         * redundant writes — never a missed review. It also means an owner
         * reply added on Google to an old review now flows back in on an
         * incremental sync instead of waiting for ?full=1.
         */
        const changedAt = new Date(rev.updateTime ?? rev.createTime ?? Date.now());
        if (since && changedAt <= since) {
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

/**
 * Every review provider is normalised down to this shape. Swapping providers
 * (mock -> Outscraper -> Google Business Profile) should never require touching
 * the sync logic, the database, or the UI.
 */

export type SourceLocation = {
  /** Stable id in the provider's own namespace (place_id, GBP location name…). */
  externalId: string;
  name: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  googleUrl?: string | null;
  /** Aggregate rating as the provider reports it, if it exposes one. */
  reportedRating?: number | null;
  reportedReviewCount?: number | null;
};

export type SourceReview = {
  externalId: string;
  locationExternalId: string;
  authorName?: string | null;
  authorPhotoUrl?: string | null;
  /** 1–5. */
  rating: number;
  text?: string | null;
  publishedAt: Date;
  /** A reply already visible on Google, if the provider returns it. */
  existingReplyText?: string | null;
  existingReplyAt?: Date | null;
};

/**
 * Publishing is optional and rare: of the platforms here only Google Business
 * Profile exposes a write API. A source that can't publish simply omits
 * `postReply`, and the UI falls back to copy-and-paste.
 */
export interface ReplyCapableSource extends ReviewSource {
  /** False when the credentials are present but lack write scope. */
  canPublish(): boolean;
  /**
   * Publish `text` as the owner's public reply. Overwrites any existing reply,
   * which is how the platform models an edit. Throws on failure — the caller
   * must not record a reply as published unless this resolves.
   */
  postReply(input: {
    locationExternalId: string;
    reviewExternalId: string;
    text: string;
  }): Promise<void>;
}

export function canPublish(source: ReviewSource): source is ReplyCapableSource {
  const candidate = source as Partial<ReplyCapableSource>;
  return (
    typeof candidate.postReply === "function" &&
    typeof candidate.canPublish === "function" &&
    candidate.canPublish()
  );
}

export interface ReviewSource {
  /** Machine name, stored on every row so mixed-source data stays separable. */
  readonly name: string;
  /** Human-readable note shown in the UI when the source is misconfigured. */
  readonly configHint: string;
  /** False when required env vars are missing — sync fails loudly instead of silently. */
  isConfigured(): boolean;
  listLocations(): Promise<SourceLocation[]>;
  /**
   * Reviews for one location. `since` is the newest publishedAt we already
   * hold; providers that support incremental fetches should use it to stop early.
   */
  fetchReviews(location: SourceLocation, since?: Date): Promise<SourceReview[]>;
}

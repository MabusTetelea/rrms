import { GbpSource } from "./gbp";
import { MockSource } from "./mock";
import { OutscraperSource } from "./outscraper";
import { SerpApiSource } from "./serpapi";
import { canPublish } from "./types";
import type { ReplyCapableSource, ReviewSource } from "./types";

export type {
  ReviewSource,
  ReplyCapableSource,
  SourceLocation,
  SourceReview,
} from "./types";
export { canPublish } from "./types";

const REGISTRY: Record<string, () => ReviewSource> = {
  mock: () => new MockSource(),
  outscraper: () => new OutscraperSource(),
  serpapi: () => new SerpApiSource(),
  gbp: () => new GbpSource(),
};

export const SOURCE_NAMES = Object.keys(REGISTRY);

function build(key: string): ReviewSource {
  const factory = REGISTRY[key];
  if (!factory) {
    throw new Error(
      `Unknown review source "${key}". Expected one of: ${SOURCE_NAMES.join(", ")}`,
    );
  }
  return factory();
}

/**
 * REVIEW_SOURCE takes a comma-separated list. Every source here reads Google,
 * so a deployment normally runs one — but the list is kept because a migration
 * (say scraper -> gbp) wants both running for a while.
 */
export function getReviewSources(value?: string): ReviewSource[] {
  const keys = (value ?? process.env.REVIEW_SOURCE ?? "mock")
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);

  if (keys.length === 0) return [build("mock")];
  // Deduplicate so a repeated entry doesn't run the same scraper twice.
  return [...new Set(keys)].map(build);
}

/** First configured source. For UI that shows a single "active source". */
export function getReviewSource(name?: string): ReviewSource {
  return getReviewSources(name)[0];
}

/**
 * The configured source that can publish replies, if any. Returns null when
 * nothing is publish-capable, which is the normal state — the app then stays
 * in copy-and-paste mode.
 */
export function getPublishingSource(): ReplyCapableSource | null {
  for (const source of getReviewSources()) {
    if (canPublish(source)) return source;
  }
  return null;
}

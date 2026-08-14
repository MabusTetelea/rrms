import { GbpSource } from "./gbp";
import { MockSource } from "./mock";
import { OutscraperSource } from "./outscraper";
import { SerpApiSource } from "./serpapi";
import { YandexSource } from "./yandex";
import type { ReviewSource } from "./types";

export type { ReviewSource, SourceLocation, SourceReview } from "./types";

const REGISTRY: Record<string, () => ReviewSource> = {
  mock: () => new MockSource(),
  outscraper: () => new OutscraperSource(),
  serpapi: () => new SerpApiSource(),
  gbp: () => new GbpSource(),
  yandex: () => new YandexSource(),
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
 * REVIEW_SOURCE takes a comma-separated list — Google and Yandex are different
 * audiences, not alternatives, so a real deployment runs several at once.
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

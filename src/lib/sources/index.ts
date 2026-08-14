import { GbpSource } from "./gbp";
import { MockSource } from "./mock";
import { OutscraperSource } from "./outscraper";
import { SerpApiSource } from "./serpapi";
import type { ReviewSource } from "./types";

export type { ReviewSource, SourceLocation, SourceReview } from "./types";

const REGISTRY: Record<string, () => ReviewSource> = {
  mock: () => new MockSource(),
  outscraper: () => new OutscraperSource(),
  serpapi: () => new SerpApiSource(),
  gbp: () => new GbpSource(),
};

export const SOURCE_NAMES = Object.keys(REGISTRY);

/** Resolves REVIEW_SOURCE (default `mock`) to a concrete adapter. */
export function getReviewSource(name?: string): ReviewSource {
  const key = (name ?? process.env.REVIEW_SOURCE ?? "mock").toLowerCase();
  const factory = REGISTRY[key];
  if (!factory) {
    throw new Error(
      `Unknown REVIEW_SOURCE "${key}". Expected one of: ${SOURCE_NAMES.join(", ")}`,
    );
  }
  return factory();
}

import {
  MOCK_AUTHORS_EN,
  MOCK_AUTHORS_RO,
  MOCK_AUTHORS_RU,
  MOCK_LOCATIONS,
  MOCK_REVIEW_TEXTS,
} from "./mock-data";
import { companyName } from "@/lib/company";
import type { ReviewSource, SourceLocation, SourceReview } from "./types";

/**
 * Deterministic demo source. Every run produces byte-identical reviews with
 * stable external ids, so re-syncing updates rows instead of duplicating them
 * and the dashboard numbers don't jump around between restarts.
 */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

/**
 * Per-store rating distribution. Different stores perform differently — that's
 * the whole point of the per-location leaderboard, so the demo data reflects it.
 */
const QUALITY_PROFILES: Record<string, [number, number, number, number, number]> = {
  //                                     1★   2★   3★   4★   5★
  "shop-central-high": /*  busy   */ [14, 14, 22, 26, 24],
  "shop-riverside": [7, 9, 17, 31, 36],
  "shop-northgate": [8, 10, 18, 30, 34],
  "shop-hilltop": /*   strong */ [4, 6, 12, 30, 48],
  "shop-southbank": /* weak   */ [18, 16, 20, 24, 22],
  "shop-parkside": [6, 8, 16, 32, 38],
  "shop-eastfield": [7, 10, 20, 30, 33],
  "shop-oakwood": [6, 8, 18, 30, 38],
  "shop-westport": /*  worst  */ [22, 18, 21, 21, 18],
  "shop-meadowbrook": [5, 7, 15, 31, 42],
  "shop-stonebridge": [10, 11, 19, 29, 31],
  "shop-lakeside": [4, 6, 14, 32, 44],
};

const DEFAULT_PROFILE: [number, number, number, number, number] = [8, 10, 18, 30, 34];

function weightedRating(r: () => number, weights: number[]): 1 | 2 | 3 | 4 | 5 {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x <= 0) return (i + 1) as 1 | 2 | 3 | 4 | 5;
  }
  return 5;
}

const DAY_MS = 86_400_000;

function generateForLocation(location: SourceLocation): SourceReview[] {
  const seed = hashString(location.externalId);
  const r = rng(seed);
  const weights = QUALITY_PROFILES[location.externalId] ?? DEFAULT_PROFILE;

  const count = 22 + Math.floor(r() * 34);
  // Anchor to midnight UTC so reruns on the same day stay identical.
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;

  const reviews: SourceReview[] = [];
  for (let i = 0; i < count; i++) {
    const rating = weightedRating(r, weights);

    /*
     * Mostly English, with a fifth split between Romanian and Russian. Replies
     * always follow the language the customer wrote in, and an all-English
     * dataset can't show that working.
     */
    const draw = r();
    const lang: "en" | "ro" | "ru" = draw < 0.8 ? "en" : draw < 0.9 ? "ro" : "ru";
    const texts = MOCK_REVIEW_TEXTS[rating][lang];
    const authors =
      lang === "en" ? MOCK_AUTHORS_EN : lang === "ro" ? MOCK_AUTHORS_RO : MOCK_AUTHORS_RU;

    // Spread over the last ~180 days, denser toward the present.
    const ageDays = Math.floor(Math.pow(r(), 1.7) * 180);
    const publishedAt = new Date(today - ageDays * DAY_MS - Math.floor(r() * DAY_MS));

    // ~12% of reviews are a bare star rating with no text at all.
    const hasText = r() > 0.12;

    // A slice of older reviews already carry a reply posted on Google.
    const alreadyReplied = ageDays > 45 && r() < 0.35;

    reviews.push({
      externalId: `${location.externalId}-r${i}`,
      locationExternalId: location.externalId,
      authorName: pick(r, authors),
      authorPhotoUrl: null,
      rating,
      text: hasText ? pick(r, texts) : null,
      publishedAt,
      // Answered in the language the customer used, like a real owner reply.
      existingReplyText: alreadyReplied
        ? lang === "en"
          ? "Thank you for the feedback. We've passed it on to the store team."
          : lang === "ro"
            ? "Vă mulțumim pentru feedback! L-am transmis echipei magazinului."
            : "Спасибо за отзыв! Мы передали его команде магазина."
        : null,
      existingReplyAt: alreadyReplied
        ? new Date(publishedAt.getTime() + 2 * DAY_MS)
        : null,
    });
  }

  return reviews.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export class MockSource implements ReviewSource {
  readonly name = "mock";
  readonly configHint = "No configuration needed — seeded demo data.";

  isConfigured() {
    return true;
  }

  async listLocations(): Promise<SourceLocation[]> {
    /*
     * The fixture names stores after their area alone ("Botanica"), and the
     * configured chain is prefixed here. That keeps the demo data
     * brand-neutral in the repository while a real deployment's demo estate
     * still reads like its own.
     */
    const brand = companyName();

    return MOCK_LOCATIONS.map((loc) => {
      const generated = generateForLocation(loc);
      const sum = generated.reduce((acc, rev) => acc + rev.rating, 0);
      return {
        ...loc,
        name: brand ? `${brand} — ${loc.name}` : loc.name,
        reportedRating: Number((sum / generated.length).toFixed(1)),
        reportedReviewCount: generated.length,
        googleUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${loc.name} ${loc.address ?? ""}`,
        )}`,
      };
    });
  }

  async fetchReviews(location: SourceLocation, since?: Date): Promise<SourceReview[]> {
    const all = generateForLocation(location);
    if (!since) return all;
    return all.filter((rev) => rev.publishedAt > since);
  }
}

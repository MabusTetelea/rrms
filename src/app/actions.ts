"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, replies, reviews } from "@/db/schema";
import { getPublishingSource } from "@/lib/sources";
import { generateSuggestions } from "@/lib/ai/suggest";
import { isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { currentUserOrNull, type SessionUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { hit } from "@/lib/rate-limit";
import { DEFAULT_BRAND_VOICE, setBrandVoice } from "@/lib/settings";
import { runSync } from "@/lib/sync";

/**
 * Server actions are individually addressable POST endpoints — the check in
 * (app)/layout.tsx does not cover them. Every action below authenticates for
 * itself, and returns an error rather than redirecting so the caller can show
 * it in place.
 */
const DENIED = { ok: false as const, error: "Not signed in." };
const NOT_ADMIN = { ok: false as const, error: "Admins only." };

async function requireOperator(): Promise<SessionUser | null> {
  return currentUserOrNull();
}

async function requireAdminUser(): Promise<SessionUser | null> {
  const user = await currentUserOrNull();
  return user?.role === "admin" ? user : null;
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export type DraftsResult =
  | {
      ok: true;
      suggestions: { id: string; tone: string; text: string; model: string }[];
    }
  | { ok: false; error: string };

/**
 * Per-operator ceiling on drafting.
 *
 * This is the only action that spends someone else's quota — the free tier is
 * 50 requests a day for the whole deployment, and one click is one request. A
 * held-down G key, or a double-click on a slow connection, could burn the day's
 * allowance for everyone before anyone noticed. 20 an hour is far more than
 * answering reviews actually needs and still leaves room for a second operator.
 */
const DRAFT_LIMIT = { max: 20, windowMs: 60 * 60_000 };

export async function generateDraftsAction(
  reviewId: string,
  extraInstruction?: string,
): Promise<DraftsResult> {
  // Guarded first: an unauthenticated caller must not be able to spend tokens.
  const user = await requireOperator();
  if (!user) return DENIED;

  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      error: "OPENROUTER_API_KEY is not set.",
    };
  }

  // Counted before the call, so a request that fails upstream still costs a
  // slot — a failing model is exactly when a frustrated operator retries most.
  const quota = hit(`drafts:${user.id}`, DRAFT_LIMIT);
  if (!quota.ok) {
    const minutes = Math.max(
      1,
      Math.ceil((quota.resetAt.getTime() - Date.now()) / 60_000),
    );
    return {
      ok: false,
      error: `Draft limit reached (${DRAFT_LIMIT.max} per hour). Try again in ${minutes} min, or write the reply by hand.`,
    };
  }

  try {
    const generated = await generateSuggestions(reviewId, { extraInstruction });
    revalidatePath("/inbox");
    return {
      ok: true,
      suggestions: generated.map((s) => ({
        id: s.id,
        tone: s.tone,
        text: s.text,
        model: s.model,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Records the reply the operator settled on and takes the review out of the
 * queue. Publishing itself happens in Google — this app is the drafting desk.
 */
export async function saveReplyAction(
  reviewId: string,
  text: string,
  suggestionId?: string | null,
  originalSuggestionText?: string | null,
): Promise<ActionResult> {
  const user = await requireOperator();
  if (!user) return DENIED;

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty reply." };

  try {
    await db.insert(replies).values({
      reviewId,
      suggestionId: suggestionId || null,
      text: trimmed,
      edited: Boolean(originalSuggestionText && originalSuggestionText.trim() !== trimmed),
      userId: user.id,
      // Snapshot the name so the trail survives a rename or a removed account.
      operator: user.name,
    });

    await db
      .update(reviews)
      .set({ status: "replied", updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));

    revalidatePath("/inbox");
    revalidatePath("/overview");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type PublishResult =
  | { ok: true; publishedAt: string }
  | { ok: false; error: string };

/**
 * Publish a reply to the platform, then record it.
 *
 * Ordering matters and is deliberate: Google is called first and the database
 * is only written if it succeeds. The reverse order would let a failed publish
 * leave a review marked as answered when nothing is public — the one wrong
 * state an operator can't detect from inside the app.
 *
 * This is never automatic. The UI requires an explicit click and a
 * confirmation, and this action re-checks that publishing is switched on.
 */
export async function publishReplyAction(
  reviewId: string,
  text: string,
  suggestionId?: string | null,
  originalSuggestionText?: string | null,
): Promise<PublishResult> {
  const user = await requireOperator();
  if (!user) return DENIED;

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty reply." };

  const source = getPublishingSource();
  if (!source) {
    return {
      ok: false,
      error:
        "Publishing is off. It needs REVIEW_SOURCE to include gbp, the Google credentials set, and PUBLISH_REPLIES=true.",
    };
  }

  try {
    const [row] = await db
      .select({ review: reviews, location: locations })
      .from(reviews)
      .innerJoin(locations, eq(reviews.locationId, locations.id))
      .where(eq(reviews.id, reviewId));

    if (!row) return { ok: false, error: "Review not found." };

    // A review pulled from a different source has no id Google would accept.
    if (row.review.source !== source.name) {
      return {
        ok: false,
        error: `This review came from "${row.review.source}", which cannot publish. Copy it across by hand.`,
      };
    }

    await source.postReply({
      locationExternalId: row.location.externalId,
      reviewExternalId: row.review.externalId,
      text: trimmed,
    });

    const publishedAt = new Date();

    await db.insert(replies).values({
      reviewId,
      suggestionId: suggestionId || null,
      text: trimmed,
      edited: Boolean(
        originalSuggestionText && originalSuggestionText.trim() !== trimmed,
      ),
      userId: user.id,
      operator: user.name,
      publishedAt,
    });

    // Mirror what is now public, so the UI shows it without waiting for a sync.
    await db
      .update(reviews)
      .set({
        status: "replied",
        existingReplyText: trimmed,
        existingReplyAt: publishedAt,
        updatedAt: publishedAt,
      })
      .where(eq(reviews.id, reviewId));

    revalidatePath("/inbox");
    revalidatePath("/overview");
    return { ok: true, publishedAt: publishedAt.toISOString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setReviewStatusAction(
  reviewId: string,
  status: "new" | "in_progress" | "replied" | "skipped",
): Promise<ActionResult> {
  if (!(await requireOperator())) return DENIED;

  try {
    await db
      .update(reviews)
      .set({ status, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    revalidatePath("/inbox");
    revalidatePath("/overview");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type SyncActionResult =
  | { ok: true; reviewsNew: number; locations: number; sources: string[] }
  | { ok: false; error: string };

export async function syncAction(): Promise<SyncActionResult> {
  // Admin-only: a sync can burn a paid provider's quota.
  if (!(await requireAdminUser())) return NOT_ADMIN;

  try {
    const results = await runSync();
    revalidatePath("/", "layout");
    return {
      ok: true,
      // One run per configured source — report the totals across all of them.
      reviewsNew: results.reduce((sum, r) => sum + r.reviewsNew, 0),
      locations: results.reduce((sum, r) => sum + r.locationsUpserted, 0),
      sources: results.map((r) => r.source),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fold one location into another, so the same physical shop listed on two
 * platforms counts once. Admin-only: it changes every rating and backlog figure
 * on the dashboard.
 */
export async function mergeLocationAction(
  sourceId: string,
  targetId: string,
): Promise<ActionResult> {
  if (!(await requireAdminUser())) return NOT_ADMIN;
  if (sourceId === targetId) {
    return { ok: false, error: "A store cannot be merged into itself." };
  }

  try {
    const [target] = await db
      .select({ id: locations.id, mergedInto: locations.mergedInto })
      .from(locations)
      .where(eq(locations.id, targetId));

    if (!target) return { ok: false, error: "Target store not found." };
    // Only one level of merging — otherwise the rollup needs a recursive CTE.
    if (target.mergedInto) {
      return { ok: false, error: "That store is itself merged into another one." };
    }

    // Anything already pointing at the row being merged has to follow it over,
    // or it would be orphaned behind a non-canonical parent.
    await db
      .update(locations)
      .set({ mergedInto: targetId, updatedAt: new Date() })
      .where(eq(locations.mergedInto, sourceId));

    await db
      .update(locations)
      .set({ mergedInto: targetId, updatedAt: new Date() })
      .where(eq(locations.id, sourceId));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function unmergeLocationAction(id: string): Promise<ActionResult> {
  if (!(await requireAdminUser())) return NOT_ADMIN;

  try {
    await db
      .update(locations)
      .set({ mergedInto: null, updatedAt: new Date() })
      .where(eq(locations.id, id));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveBrandVoiceAction(formData: FormData): Promise<ActionResult> {
  // Admin-only: this text steers every published reply.
  if (!(await requireAdminUser())) return NOT_ADMIN;

  const maxSentences = Number(formData.get("maxSentences"));

  try {
    await setBrandVoice({
      guidelines:
        String(formData.get("guidelines") ?? "").trim() ||
        DEFAULT_BRAND_VOICE.guidelines,
      contactChannel: String(formData.get("contactChannel") ?? "").trim(),
      signature: String(formData.get("signature") ?? "").trim(),
      maxSentences:
        Number.isFinite(maxSentences) && maxSentences >= 1 && maxSentences <= 8
          ? Math.round(maxSentences)
          : DEFAULT_BRAND_VOICE.maxSentences,
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

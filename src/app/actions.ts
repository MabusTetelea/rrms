"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { replies, reviews } from "@/db/schema";
import { generateSuggestions } from "@/lib/ai/suggest";
import { isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { currentUserOrNull, type SessionUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
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

export async function generateDraftsAction(
  reviewId: string,
  extraInstruction?: string,
): Promise<DraftsResult> {
  // Guarded first: an unauthenticated caller must not be able to spend tokens.
  if (!(await requireOperator())) return DENIED;

  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      error: "OPENROUTER_API_KEY is not set.",
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
    revalidatePath("/");
    return { ok: true };
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
    revalidatePath("/");
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

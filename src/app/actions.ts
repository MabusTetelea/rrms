"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { replies, reviews } from "@/db/schema";
import { generateSuggestions } from "@/lib/ai/suggest";
import { isOpenRouterConfigured } from "@/lib/ai/openrouter";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { DEFAULT_BRAND_VOICE, setBrandVoice } from "@/lib/settings";
import { runSync } from "@/lib/sync";

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
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty reply." };

  try {
    await db.insert(replies).values({
      reviewId,
      suggestionId: suggestionId || null,
      text: trimmed,
      edited: Boolean(originalSuggestionText && originalSuggestionText.trim() !== trimmed),
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
  | { ok: true; reviewsNew: number; locations: number }
  | { ok: false; error: string };

export async function syncAction(): Promise<SyncActionResult> {
  try {
    const result = await runSync();
    revalidatePath("/", "layout");
    return {
      ok: true,
      reviewsNew: result.reviewsNew,
      locations: result.locationsUpserted,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveBrandVoiceAction(formData: FormData): Promise<ActionResult> {
  const maxSentences = Number(formData.get("maxSentences"));

  try {
    await setBrandVoice({
      companyName:
        String(formData.get("companyName") ?? "").trim() ||
        DEFAULT_BRAND_VOICE.companyName,
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

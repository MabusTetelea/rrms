import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, reviews, suggestions } from "@/db/schema";
import { chatJson } from "./openrouter";
import { COMPANY_NAME, getBrandVoice, type BrandVoice } from "@/lib/settings";
import { detectLanguage } from "@/lib/text";

/**
 * The three registers an operator picks between. Fixed slots (rather than
 * letting the model invent labels) so the UI can render them in a stable order
 * and the operator learns where to look.
 */
export const TONES = ["standard", "empathetic", "brief"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_BRIEFS: Record<Tone, string> = {
  standard:
    "Balanced and professional. The default a customer-care team would publish.",
  empathetic:
    "Noticeably warmer and more personal. Leans into the feeling behind the review.",
  brief: "One or two short sentences. For obvious cases that don't need a paragraph.",
};

const LANGUAGE_NAMES: Record<string, string> = {
  ro: "Romanian",
  ru: "Russian",
  en: "English",
};

function systemPrompt(voice: BrandVoice): string {
  return [
    `You write public replies to customer reviews for ${COMPANY_NAME}, a supermarket chain in the Republic of Moldova.`,
    "",
    "BRAND VOICE:",
    voice.guidelines,
    "",
    "HARD RULES — these override the brand voice:",
    `1. Write the reply in the SAME language as the review. Never switch languages, never translate, never reply bilingually.`,
    `2. Never invent facts. Do not state causes, dates, names, policies or outcomes you were not given.`,
    `3. Never promise refunds, vouchers, discounts or compensation of any kind.`,
    voice.contactChannel
      ? `4. When directing the customer somewhere, use exactly this channel: ${voice.contactChannel}. Never invent another phone number, email or link.`
      : `4. Do not offer a phone number, email address or link — none is configured. Invite them to speak to the store team instead.`,
    `5. Keep each reply to at most ${voice.maxSentences} sentences.`,
    `6. No emoji. No hashtags. No marketing slogans.`,
    voice.signature
      ? `7. End every reply with the sign-off: ${voice.signature}`
      : `7. Do not add a sign-off or signature.`,
    "",
    "Write three genuinely different options — different opening, different structure, different length.",
    "Do not produce three paraphrases of the same sentence.",
    "",
    "Return ONLY a JSON object of this exact shape:",
    `{"language":"ro|ru|en","options":[{"tone":"standard","text":"..."},{"tone":"empathetic","text":"..."},{"tone":"brief","text":"..."}]}`,
  ].join("\n");
}

function userPrompt(input: {
  storeName: string;
  city: string | null;
  rating: number;
  publishedAt: Date;
  text: string | null;
  language: string;
  topics: string[] | null;
  extraInstruction?: string;
}): string {
  const langName = LANGUAGE_NAMES[input.language] ?? "the language of the review";

  const lines = [
    `Store: ${input.storeName}${input.city ? ` (${input.city})` : ""}`,
    `Rating: ${input.rating} out of 5`,
    `Posted: ${input.publishedAt.toISOString().slice(0, 10)}`,
    `Review language: ${langName} — reply in ${langName}.`,
  ];

  if (input.topics?.length) {
    lines.push(`Detected topics: ${input.topics.join(", ")}`);
  }

  lines.push("", "Review text:");
  lines.push(
    input.text?.trim()
      ? `"""${input.text.trim()}"""`
      : "(The customer left a star rating with no written text. Keep the replies short and generic — there is nothing specific to respond to.)",
  );

  if (input.extraInstruction?.trim()) {
    lines.push("", `Additional instruction from the operator: ${input.extraInstruction.trim()}`);
  }

  lines.push(
    "",
    "TONES:",
    ...TONES.map((tone) => `- ${tone}: ${TONE_BRIEFS[tone]}`),
  );

  return lines.join("\n");
}

type ModelResponse = {
  language?: string;
  options?: { tone?: string; text?: string }[];
};

export type GeneratedSuggestion = {
  id: string;
  tone: string;
  text: string;
  language: string | null;
  model: string;
  generationId: string;
};

/**
 * Generate and persist a fresh batch of drafts for one review. Older batches
 * are kept — an operator who liked a previous wording can still scroll back.
 */
export async function generateSuggestions(
  reviewId: string,
  opts: { extraInstruction?: string } = {},
): Promise<GeneratedSuggestion[]> {
  const [row] = await db
    .select({
      review: reviews,
      location: locations,
    })
    .from(reviews)
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .where(eq(reviews.id, reviewId));

  if (!row) throw new Error(`Review ${reviewId} not found`);

  const voice = await getBrandVoice();
  // Fall back to Romanian for textless reviews: it's the majority language and
  // the reply will be generic anyway.
  const language = row.review.language ?? detectLanguage(row.review.text) ?? "ro";
  const effectiveLanguage = language === "other" ? "ro" : language;

  const { data, model } = await chatJson<ModelResponse>([
    { role: "system", content: systemPrompt(voice) },
    {
      role: "user",
      content: userPrompt({
        storeName: row.location.name,
        city: row.location.city,
        rating: row.review.rating,
        publishedAt: row.review.publishedAt,
        text: row.review.text,
        language: effectiveLanguage,
        topics: row.review.topics,
        extraInstruction: opts.extraInstruction,
      }),
    },
  ]);

  const generationId = randomUUID();

  // Map model output onto our fixed tone slots, tolerating an unexpected label
  // or a short array rather than throwing the whole batch away.
  const byTone = new Map<string, string>();
  for (const option of data.options ?? []) {
    const text = option.text?.trim();
    if (!text) continue;
    const tone = TONES.includes(option.tone as Tone) ? option.tone! : null;
    if (tone && !byTone.has(tone)) byTone.set(tone, text);
    else byTone.set(`variant-${byTone.size + 1}`, text);
  }

  if (byTone.size === 0) {
    throw new Error("The model returned no usable reply options.");
  }

  const rows = [...byTone.entries()].map(([tone, text]) => ({
    reviewId,
    generationId,
    tone,
    text,
    language: data.language ?? effectiveLanguage,
    model,
  }));

  const inserted = await db.insert(suggestions).values(rows).returning();

  // Picking up a review implies the operator is working it.
  if (row.review.status === "new") {
    await db
      .update(reviews)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
  }

  return inserted.map((s) => ({
    id: s.id,
    tone: s.tone,
    text: s.text,
    language: s.language,
    model: s.model,
    generationId: s.generationId,
  }));
}

/** The most recent batch of drafts for a review, newest generation first. */
export async function latestSuggestions(reviewId: string) {
  const rows = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.reviewId, reviewId))
    .orderBy(desc(suggestions.createdAt));

  if (rows.length === 0) return [];

  const newestGeneration = rows[0].generationId;
  const batch = rows.filter((r) => r.generationId === newestGeneration);

  // Present fixed tones in their canonical order, extras after.
  return batch.sort((a, b) => {
    const ai = TONES.indexOf(a.tone as Tone);
    const bi = TONES.indexOf(b.tone as Tone);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Brand voice is editable at runtime (Settings page) rather than hardcoded in
 * the prompt, so customer-care can tune the tone without a deploy.
 *
 * Which chain this deployment serves is a different question, and lives in
 * lib/company — it is configuration, not a preference.
 */

export type BrandVoice = {
  /** Free text folded into the system prompt. */
  guidelines: string;
  /**
   * Where to send an unhappy customer. Left empty by default on purpose — the
   * model is told never to invent contact details, so an empty value simply
   * means replies won't offer a channel.
   */
  contactChannel: string;
  /** Optional sign-off, e.g. "The store team". Empty = no sign-off. */
  signature: string;
  maxSentences: number;
};

export const DEFAULT_BRAND_VOICE: BrandVoice = {
  guidelines: [
    "Warm, respectful and concrete. Speak like a person from the store team, not a press office.",
    "For criticism: acknowledge the specific problem, apologise plainly, say what will be checked or done.",
    "For praise: thank them and mention the specific thing they liked.",
    "Never argue with the customer in public, even when they are wrong.",
  ].join(" "),
  contactChannel: "",
  signature: "",
  maxSentences: 4,
};

const BRAND_VOICE_KEY = "brand_voice";

export async function getBrandVoice(): Promise<BrandVoice> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, BRAND_VOICE_KEY));

  if (!row) return DEFAULT_BRAND_VOICE;
  // Merge so a setting added in a later version still gets its default.
  return { ...DEFAULT_BRAND_VOICE, ...(row.value as Partial<BrandVoice>) };
}

export async function setBrandVoice(voice: BrandVoice): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: BRAND_VOICE_KEY, value: voice })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: voice, updatedAt: new Date() },
    });
}

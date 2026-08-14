/**
 * Cheap, deterministic text analysis run at sync time. Deliberately not an LLM
 * call: language and topic tags are needed for every review including the
 * thousands nobody will ever reply to, and paying per token for that is silly.
 * The model only gets involved when an operator asks for a draft.
 */

export type Lang = "ro" | "ru" | "en" | "other";

const CYRILLIC = /[Ѐ-ӿ]/;
const RO_DIACRITICS = /[ăâîșşțţĂÂÎȘŞȚŢ]/;

// Short, high-frequency words that rarely collide across these three languages.
const RO_WORDS =
  /\b(și|este|foarte|magazin|produse|preț|preturi|personal|casa|casă|mereu|bun|buna|bună|nu|dar|am|la|de|cu|pentru|acest|acesta)\b/gi;
const EN_WORDS =
  /\b(the|and|is|very|store|shop|staff|price|prices|good|bad|always|never|but|with|for|this)\b/gi;

/**
 * Script first (Cyrillic is unambiguous here), then a stopword count between
 * Romanian and English. Moldovan reviews are overwhelmingly ro/ru, so a wrong
 * guess mostly means falling back to "other" and letting the model decide.
 */
export function detectLanguage(text?: string | null): Lang {
  if (!text) return "other";
  const trimmed = text.trim();
  if (trimmed.length < 3) return "other";

  if (CYRILLIC.test(trimmed)) return "ru";
  if (RO_DIACRITICS.test(trimmed)) return "ro";

  const ro = trimmed.match(RO_WORDS)?.length ?? 0;
  const en = trimmed.match(EN_WORDS)?.length ?? 0;

  if (ro === 0 && en === 0) return "other";
  return ro >= en ? "ro" : "en";
}

export const TOPIC_KEYS = [
  "queues",
  "staff",
  "pricing",
  "price_mismatch",
  "cleanliness",
  "freshness",
  "assortment",
  "hours",
  "loyalty",
  "checkout_tech",
] as const;

export type Topic = (typeof TOPIC_KEYS)[number];

/**
 * Word-start guard. A plain `\b` is ASCII-only, so it never matches in front of
 * a Cyrillic word — which silently dropped every Russian review's tags. The
 * Unicode lookbehind works for both alphabets.
 */
const W = "(?<!\\p{L})";

function topicPattern(alternatives: string): RegExp {
  return new RegExp(`${W}(?:${alternatives})`, "iu");
}

const TOPIC_PATTERNS: Record<Topic, RegExp> = {
  queues: topicPattern(
    "coad[ăa]|cozi|a[șs]teptare|aglomer|очеред|ждать|ожидан|простоял|queue|line|wait",
  ),
  staff: topicPattern(
    "personal|angajat|casier|vânz[ăa]tor|amabil|nepolitic|персонал|сотрудник|кассир|продавец|вежлив|груб|хамит|нахамил|staff|cashier|rude|friendly",
  ),
  pricing: topicPattern(
    "pre[țt]|scump|ieftin|promo[țt]i|reducer|цена|цены|ценах|дорого|дёшево|дешево|акци|скидк|price|expensive|cheap|discount",
  ),
  price_mismatch: topicPattern(
    "nu corespunde|alt pre[țt]|pre[țt]ul de pe raft|ценник.{0,20}не совпада|не совпада|different price|shelf price",
  ),
  cleanliness: topicPattern(
    "curat|murdar|igien|podea|чист|грязн|уборк|неухоженн|clean|dirty|hygien",
  ),
  freshness: topicPattern(
    // Russian inflects the noun, so match the stem rather than one exact form.
    "expirat|proasp[ăa]t|ofilit|termen de valabilitate|miros|стух|просроч|свеж|вял|запах|срок\\p{L}*\\s+годност|истёк|истек[ш]|expired|fresh|spoiled|smell",
  ),
  assortment: topicPattern(
    "sortiment|lipse|nu am g[ăa]sit|rafturi goale|stoc|ассортимент|нет в наличии|пуст.{0,8}полк|полки пуст|отсутств|выбор|заканчивается|assortment|out of stock|empty shelves|selection",
  ),
  hours: topicPattern(
    "program|deschis|închis|inchis|p[âa]n[ăa] t[âa]rziu|orar|график|открыт|закрыт|допоздна|часы работы|hours|open late|closed",
  ),
  loyalty: topicPattern(
    "fidelitate|card de|aplica[țt]i|puncte|лояльност|карт[аеу]|приложени|балл|loyalty|app|points",
  ),
  checkout_tech: topicPattern(
    "self.?service|self.?checkout|cas[ăa] automat|cas[ăa] self|terminal|bancomat|POS|самообслуживан|терминал|card payment",
  ),
};

/** Keyword tags used for the dashboard's "what people complain about" panel. */
export function extractTopics(text?: string | null): Topic[] {
  if (!text) return [];
  return TOPIC_KEYS.filter((topic) => TOPIC_PATTERNS[topic].test(text));
}

export type Sentiment = "positive" | "neutral" | "negative";

/**
 * Star rating is a far more reliable sentiment signal than anything we could
 * infer from a two-word review, so we just use it.
 */
export function sentimentFromRating(rating: number): Sentiment {
  if (rating <= 2) return "negative";
  if (rating === 3) return "neutral";
  return "positive";
}

/**
 * Pure presentation helpers. Kept out of lib/queries so client components can
 * import them without dragging the Postgres driver into the browser bundle.
 */

/** Short shelf code for a store, e.g. "Market — Râșcani" -> "RIS". */
export function storeCode(name: string): string {
  const tail = name.split(/[—–-]/).pop()?.trim() || name;
  return tail
    .normalize("NFD")
    // Strip combining marks so ă/â/ș collapse to plain letters.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
}

/**
 * A store's name without the chain in front: "Market — Râșcani" becomes
 * "Râșcani". Every row on a page sits under the same brand, so repeating it
 * costs width and tells the reader nothing.
 *
 * Strips any short leading segment followed by a dash, rather than a configured
 * brand name — this runs in the browser, where the server's environment isn't
 * available. A name without a dash comes back untouched.
 */
export function storeShortName(name: string): string {
  return name.replace(/^[^—–]{1,40}\s[—–]\s/, "").trim() || name;
}

export type RatingBand = "good" | "mid" | "bad";

export function ratingBand(rating: number): RatingBand {
  if (rating >= 4.2) return "good";
  if (rating >= 3.5) return "mid";
  return "bad";
}

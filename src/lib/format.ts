/**
 * Pure presentation helpers. Kept out of lib/queries so client components can
 * import them without dragging the Postgres driver into the browser bundle.
 */

/** Short shelf code for a store, e.g. "Linella — Râșcani" -> "RIS". */
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

export type RatingBand = "good" | "mid" | "bad";

export function ratingBand(rating: number): RatingBand {
  if (rating >= 4.2) return "good";
  if (rating >= 3.5) return "mid";
  return "bad";
}

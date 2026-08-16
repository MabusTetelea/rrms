/**
 * Stores are grouped into zones so the overview can point at an area that needs
 * work rather than a list of individual shops.
 *
 * The default map is deliberately generic — compass areas plus an outer ring —
 * because this app doesn't know what country it's running in. A real deployment
 * usually wants its own: city districts, sales regions, franchise areas.
 * Rewrite ZONE_IDS, ZONE_META and ZONE_KEYWORDS below and run a sync; zones are
 * recomputed on every sync and nothing is entered by hand.
 */

export const ZONE_IDS = [
  "central",
  "north",
  "south",
  "east",
  "west",
  "suburbs",
  "unassigned",
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

/** Zones sit under one of these for grouping in the UI. */
export type ZoneRegion = "inner" | "outer" | "other";

export const ZONE_META: Record<ZoneId, { code: string; region: ZoneRegion }> = {
  central: { code: "CTR", region: "inner" },
  north: { code: "NTH", region: "inner" },
  south: { code: "STH", region: "inner" },
  east: { code: "EST", region: "inner" },
  west: { code: "WST", region: "inner" },
  suburbs: { code: "SUB", region: "outer" },
  unassigned: { code: "—", region: "other" },
};

function normalize(value: string | null | undefined): string {
  return (
    (value ?? "")
      .toLowerCase()
      .normalize("NFD")
      /*
       * Strip combining marks, so "Chișinău" matches "chisinau".
       *
       * Note what this does NOT do: â and î lose their accent to become a and i,
       * which are different letters in some languages. "Râșcani" becomes
       * "rascani", never "riscani". Any keyword for a name containing â or î has
       * to be written in the form this produces.
       */
      .replace(/[̀-ͯ]/g, "")
  );
}

/**
 * Matched against the store's city, name and address, in order — the first hit
 * wins. "suburbs" sits first so an outer-ring store isn't captured by a compass
 * word that happens to appear in its address.
 */
const ZONE_KEYWORDS: { zone: ZoneId; keywords: string[] }[] = [
  { zone: "suburbs", keywords: ["suburb", "outskirt", "outer"] },
  { zone: "central", keywords: ["central", "centre", "center", "downtown", "city centre"] },
  { zone: "north", keywords: ["north"] },
  { zone: "south", keywords: ["south"] },
  { zone: "east", keywords: ["east"] },
  { zone: "west", keywords: ["west"] },
];

/**
 * Works out which zone a store belongs to from its city, name and address.
 * Falls back to "unassigned" rather than guessing, so a store that matches
 * nothing shows up in the UI as needing attention instead of being filed
 * wrongly and quietly skewing an area's figures.
 */
export function resolveZone(location: {
  name: string;
  city?: string | null;
  address?: string | null;
}): ZoneId {
  const haystack = `${normalize(location.city)} ${normalize(location.name)} ${normalize(
    location.address,
  )}`;

  for (const { zone, keywords } of ZONE_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return zone;
  }

  return "unassigned";
}

export function isZoneId(value: string | undefined): value is ZoneId {
  return ZONE_IDS.includes(value as ZoneId);
}

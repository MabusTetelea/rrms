/**
 * Stores are grouped into zones so the overview can point at an area that needs
 * work rather than a list of 180 individual shops.
 *
 * Chișinău is split by sector — that's how the city is actually managed, and
 * it's where most of the estate sits. Everything outside the capital is bucketed
 * into the three regional groups, because a single store per town would make
 * the grouping useless.
 *
 * To re-cut the map, edit CHISINAU_SECTORS and REGION_BY_CITY below. Zones are
 * recomputed on every sync, so a change takes effect on the next run.
 */

export const ZONE_IDS = [
  "chisinau-centru",
  "chisinau-botanica",
  "chisinau-ciocana",
  "chisinau-riscani",
  "chisinau-buiucani",
  "nord",
  "raioane-centru",
  "sud",
  "unassigned",
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

/** Zones sit under one of these for grouping in the UI. */
export type ZoneRegion = "chisinau" | "regions" | "other";

export const ZONE_META: Record<ZoneId, { code: string; region: ZoneRegion }> = {
  "chisinau-centru": { code: "CEN", region: "chisinau" },
  "chisinau-botanica": { code: "BOT", region: "chisinau" },
  "chisinau-ciocana": { code: "CIO", region: "chisinau" },
  "chisinau-riscani": { code: "RIS", region: "chisinau" },
  "chisinau-buiucani": { code: "BUI", region: "chisinau" },
  nord: { code: "NRD", region: "regions" },
  "raioane-centru": { code: "RAI", region: "regions" },
  sud: { code: "SUD", region: "regions" },
  unassigned: { code: "—", region: "other" },
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    /*
     * Strip combining marks, so "Chișinău" matches "chisinau".
     *
     * Note what this does NOT do: â and î lose their accent to become a and i,
     * which are different letters. "Râșcani" becomes "rascani", never
     * "riscani". Any keyword for a name containing â or î has to be listed in
     * the form this produces.
     */
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Localities inside Chișinău municipality. A store here is resolved to a
 * sector; a store anywhere else is resolved to a region.
 */
const CHISINAU_LOCALITIES = [
  "chisinau",
  "kishinev",
  "durlesti",
  "codru",
  "cricova",
  "sangera",
  "singera",
  "bacioi",
  "truseni",
  "stauceni",
  "vatra",
  "vadul lui voda",
  "bubuieci",
  "gratiesti",
  "ciorescu",
  "budesti",
  "tohatin",
  "colonita",
];

/**
 * Sector keywords matched against the store name and street address. Street
 * names are included because a real listing often names the street, not the
 * sector.
 */
const CHISINAU_SECTORS: { zone: ZoneId; keywords: string[] }[] = [
  {
    zone: "chisinau-botanica",
    keywords: [
      "botanica",
      "dacia",
      "cuza voda",
      "hincesti",
      "trandafirilor",
      "sarmizegetusa",
      "independentei",
    ],
  },
  {
    zone: "chisinau-ciocana",
    keywords: [
      "ciocana",
      "mircea cel batran",
      "otovasca",
      "milescu spataru",
      "ginta latina",
      "igor vieru",
    ],
  },
  {
    zone: "chisinau-riscani",
    keywords: [
      "riscani",
      /*
       * Both spellings are needed. Stripping the diacritic from "Râșcani"
       * yields "rascani", not "riscani" — â and î are their own letters, not
       * decorated i's — so a listing named "Linella Râșcani" matched nothing
       * here and fell through to the Centru default. It only looked right in
       * the demo data because that store's address mentions Kiev street.
       */
      "rascani",
      "kiev",
      "moscova",
      "ceucari",
      "dimo",
      "bogdan voievod",
      "florilor",
    ],
  },
  {
    zone: "chisinau-buiucani",
    keywords: [
      "buiucani",
      "durlesti",
      "alba iulia",
      "ion creanga",
      "liviu deleanu",
      "sucevita",
      "calea iesilor",
    ],
  },
  {
    zone: "chisinau-centru",
    keywords: [
      "centru",
      "telecentru",
      "stefan cel mare",
      "sihastrului",
      "31 august",
      "columna",
      "bucuresti",
      "negruzzi",
      "ismail",
    ],
  },
];

/** Towns outside the capital, bucketed into the three regional groups. */
const REGION_BY_CITY: Record<string, ZoneId> = {
  // North
  balti: "nord",
  soroca: "nord",
  edinet: "nord",
  drochia: "nord",
  falesti: "nord",
  glodeni: "nord",
  floresti: "nord",
  singerei: "nord",
  briceni: "nord",
  ocnita: "nord",
  donduseni: "nord",
  rezina: "nord",

  // Centre
  orhei: "raioane-centru",
  ungheni: "raioane-centru",
  ialoveni: "raioane-centru",
  straseni: "raioane-centru",
  calarasi: "raioane-centru",
  criuleni: "raioane-centru",
  anenii: "raioane-centru",
  telenesti: "raioane-centru",
  nisporeni: "raioane-centru",
  hincesti: "raioane-centru",
  dubasari: "raioane-centru",
  soldanesti: "raioane-centru",

  // South
  cahul: "sud",
  comrat: "sud",
  causeni: "sud",
  ceadir: "sud",
  taraclia: "sud",
  cimislia: "sud",
  basarabeasca: "sud",
  leova: "sud",
  cantemir: "sud",
  vulcanesti: "sud",
  // Keys are matched against normalize()'d text, which separates words with a
  // space. Written with an underscore this could never match, and every Ștefan
  // Vodă store fell through to "unassigned".
  "stefan voda": "sud",
};

/**
 * Works out which zone a store belongs to from its city, name and address.
 * Falls back to "unassigned" rather than guessing, so a store in an unmapped
 * town shows up in the UI as needing attention instead of being filed wrongly.
 */
export function resolveZone(location: {
  name: string;
  city?: string | null;
  address?: string | null;
}): ZoneId {
  const city = normalize(location.city);
  const haystack = `${normalize(location.name)} ${normalize(location.address)}`;

  const inChisinau =
    CHISINAU_LOCALITIES.some((locality) => city.includes(locality)) ||
    (!city && CHISINAU_LOCALITIES.some((locality) => haystack.includes(locality)));

  if (inChisinau) {
    for (const sector of CHISINAU_SECTORS) {
      if (sector.keywords.some((keyword) => haystack.includes(keyword))) {
        return sector.zone;
      }
    }
    // In the capital but the sector is unclear — Centru is the safest default.
    return "chisinau-centru";
  }

  for (const [town, zone] of Object.entries(REGION_BY_CITY)) {
    if (city.includes(town) || haystack.includes(town)) return zone;
  }

  return "unassigned";
}

export function isZoneId(value: string | undefined): value is ZoneId {
  return ZONE_IDS.includes(value as ZoneId);
}

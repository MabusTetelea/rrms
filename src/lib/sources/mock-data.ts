import type { SourceLocation } from "./types";

/**
 * Demo dataset for the `mock` source, so the app is fully usable before any API
 * key exists. Invented — no real business, no real person, no scraped text.
 *
 * Stores are named after their area alone; the configured COMPANY_NAME is
 * prefixed at runtime (see mock.ts), which keeps this fixture brand-neutral.
 * Names are deliberately distinct in their first three letters, because the UI
 * abbreviates each store to a three-letter code.
 */

export const MOCK_LOCATIONS: SourceLocation[] = [
  { externalId: "shop-central-high", name: "Central High Street", city: "Central District", address: "12 High Street" },
  { externalId: "shop-riverside", name: "Riverside", city: "Central District", address: "4 River Lane" },
  { externalId: "shop-northgate", name: "Northgate", city: "North District", address: "88 Northgate Road" },
  { externalId: "shop-hilltop", name: "Hilltop", city: "North District", address: "3 Hill Rise" },
  { externalId: "shop-southbank", name: "Southbank", city: "South District", address: "21 Bank Road" },
  { externalId: "shop-parkside", name: "Parkside", city: "South District", address: "9 Park Avenue" },
  { externalId: "shop-eastfield", name: "Eastfield", city: "East District", address: "55 Field Road" },
  { externalId: "shop-oakwood", name: "Oakwood", city: "East District", address: "2 Oak Street" },
  { externalId: "shop-westport", name: "Westport", city: "West District", address: "30 Harbour Way" },
  { externalId: "shop-meadowbrook", name: "Meadowbrook", city: "West District", address: "17 Brook Lane" },
  { externalId: "shop-stonebridge", name: "Stonebridge", city: "Suburbs", address: "40 Bridge Road" },
  { externalId: "shop-lakeside", name: "Lakeside", city: "Suburbs", address: "6 Lake View" },
];

export const MOCK_AUTHORS_EN = [
  "James Whitfield",
  "Sarah Hollis",
  "Daniel Okafor",
  "Priya Raman",
  "Tom Bracken",
  "Aisha Nazir",
  "Michael Yates",
  "Laura Pemberton",
  "Chris Donnelly",
  "Emma Sandoval",
  "Ben Ashworth",
  "Nadia Farrell",
  "Peter Lindqvist",
  "Grace Mbeki",
  "Oliver Stanton",
];

export const MOCK_AUTHORS_RO = ["Andrei Ciobanu", "Maria Rusu", "Elena Cebotari"];

export const MOCK_AUTHORS_RU = ["Ольга Кириллова", "Дмитрий Соколов", "Ирина Морозова"];

type Corpus = { en: string[]; ro: string[]; ru: string[] };

/**
 * Review bodies by star rating.
 *
 * Written to exercise the whole app rather than to read naturally in bulk:
 * between them these cover every topic the tagger recognises — queues, staff,
 * pricing, price mismatches, cleanliness, freshness, stock, opening hours, the
 * loyalty app and self-checkout — across all five ratings.
 *
 * A handful are Romanian and Russian on purpose. Replies are always written in
 * the language the customer used, and that's impossible to demonstrate with an
 * all-English dataset.
 */
export const MOCK_REVIEW_TEXTS: Record<1 | 2 | 3 | 4 | 5, Corpus> = {
  1: {
    en: [
      "Huge queue at the checkout. Two tills open out of eight and I waited 25 minutes for three items. Unacceptable at peak time.",
      "Bought yoghurt two days past its date. Check the expiry dates on the shelf, this is not the first time.",
      "The cashier was extremely rude and threw my change onto the counter without a word. I won't be coming back.",
      "The shelf price and the price at the till were different. I complained and was told that is what the system says. Misleading.",
      "The meat in the chilled section had a bad smell. I told a member of staff and he just shrugged.",
      "Wet floor with no warning sign at all. I nearly fell while holding my child's hand.",
      "Arrived at 8pm and the door was closed, even though the hours on the window say 9. No notice, nothing.",
    ],
    ro: [
      "Cozi enorme la case. Din șase case erau deschise doar două, am stat 25 de minute pentru trei produse.",
      "Am cumpărat iaurt expirat de două zile. Verificați termenele de valabilitate pe raft.",
    ],
    ru: [
      "Огромная очередь на кассе, работала одна касса из шести. Простояла почти полчаса из-за трёх товаров.",
      "Кассир нахамила и бросила сдачу на стойку. Больше сюда не приду.",
    ],
  },
  2: {
    en: [
      "Handy for where I live, but the shelves are empty most evenings. Bread is gone by seven.",
      "Too few tills open. The products are fine but the wait ruins it.",
      "The fruit and veg section looks neglected and a lot of it is past its best for these prices.",
      "I asked for help finding something and the assistant waved vaguely towards the far end of the store.",
      "The self service tills are down more often than they work, and nobody comes over to help.",
    ],
    ro: [
      "Magazinul e aproape de casă, dar rafturile sunt des goale seara. Pâinea se termină după ora 19.",
    ],
    ru: ["Мало открытых касс. Товары нормальные, но ожидание всё портит."],
  },
  3: {
    en: [
      "Fine for a quick shop, though basics are sometimes out of stock. Staff are polite enough.",
      "Clean and tidy, but the prices are a little above others nearby.",
      "Nothing special, does the job. Could use one more self checkout.",
      "Good selection of dairy, the bakery is disappointing.",
      "The loyalty app works well but the points take forever to add up to anything.",
    ],
    ro: ["Curat și bine organizat, însă prețurile sunt puțin peste media din zonă."],
    ru: ["Нормальный магазин для быстрых покупок, но иногда нет базовых товаров. Персонал вежливый."],
  },
  4: {
    en: [
      "Clean store, friendly staff and long opening hours. One star off for the weekend queues.",
      "Fresh vegetables and fair prices. The self checkout really helps in the morning.",
      "I find almost everything I need. Would like a wider gluten free selection.",
      "Very convenient, two minutes from home. The staff are happy to help when you ask.",
      "The discounts are genuinely good and the loyalty app is worth having. Gets busy in the evening.",
      "Open late, which has saved me more than once. Prices are reasonable for the area.",
    ],
    ro: ["Legume proaspete și prețuri corecte. Casele self-service ajută mult dimineața."],
    ru: ["Чистый магазин, вежливый персонал и удобный график. Минус звезда за очереди в выходные."],
  },
  5: {
    en: [
      "Best shop in the neighbourhood. Clean, bright, friendly staff and always fresh produce.",
      "Highly recommend. Found everything I was after and the cashiers are quick and cheerful.",
      "Excellent hours, open late. It has rescued my evening plenty of times.",
      "Quality meat and cheese, and a really good local selection. Well done to the team.",
      "I forgot my wallet and an assistant held my basket aside until I came back. Faultless service.",
      "Great prices on the discounts and the shelves are always neat. Keep it up.",
      "Card payment at the self service till is fast and the terminal actually works. Small thing, big difference.",
    ],
    ro: ["Cel mai bun magazin din cartier. Curat, luminos, personal prietenos și mereu produse proaspete."],
    ru: ["Лучший магазин в районе. Чисто, светло, приветливый персонал и всегда свежие продукты."],
  },
};

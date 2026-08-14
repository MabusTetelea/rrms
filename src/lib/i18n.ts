import type { Topic } from "@/lib/text";
import type { ZoneId, ZoneRegion } from "@/lib/zones";

/*
 * Pure data — no `next/headers` here. Client components import the dictionary
 * types and LOCALES from this file, so it has to stay runtime-agnostic.
 * Reading the cookie lives in lib/locale-server.ts.
 */

/**
 * Operator UI language. Romanian is the default because that's what the
 * customer-care desk works in; Russian and English are there for the rest of
 * the team. This is separate from the review's own language — the AI always
 * replies in whatever the customer wrote.
 */
export const LOCALES = ["ro", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ro";
export const LOCALE_COOKIE = "operator_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  ro: "Română",
  ru: "Русский",
  en: "English",
};

const en = {
  brand: "Linella",
  product: "Review desk",

  nav: {
    dashboard: "Overview",
    inbox: "Inbox",
    locations: "Stores",
    settings: "Settings",
  },

  common: {
    loading: "Loading",
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    retry: "Try again",
    reviews: "reviews",
    unanswered: "unanswered",
    all: "All",
    none: "None",
    search: "Search reviews",
    language: "Language",
  },

  dashboard: {
    title: "Overview",
    subtitle: "Where unanswered reviews are piling up, zone by zone.",
    avgRating: "Average rating",
    totalReviews: "Reviews tracked",
    unanswered: "Waiting for a reply",
    negative: "1–2 star, last 30 days",
    zonesTitle: "Zones needing work",
    zonesHint: "Ordered by how many reviews are sitting unanswered right now.",
    backlogTitle: "Stores with the biggest queue",
    backlogHint: "The individual shops behind those zone numbers.",
    zoneStores: "stores",
    zoneWorst: "Weakest",
    zoneBacklog: "Queue",
    allCaughtUp: "Nothing waiting",
    allCaughtUpBody: "Every review has an answer. Sync to check for new ones.",
    leaderboard: "Stores by rating",
    leaderboardHint: "The bar shows how the five star levels split, not just the average.",
    topics: "What customers bring up",
    topicsHint: "Keyword tags across the last 90 days.",
    topicMentions: "mentions",
    topicAvg: "avg",
    syncNow: "Sync reviews",
    syncing: "Syncing",
    lastSync: "Last sync",
    never: "never",
    syncFailed: "Sync failed",
    goToInbox: "Open the inbox",
    emptyTitle: "No reviews yet",
    emptyBody: "Run a sync to pull reviews from the configured source.",
  },

  inbox: {
    title: "Inbox",
    filterAll: "All",
    filterUnanswered: "To answer",
    filterNegative: "Negative",
    filterReplied: "Replied",
    filterSkipped: "Skipped",
    allStores: "All stores",
    queueEmpty: "Nothing here",
    queueEmptyBody: "No review matches these filters.",
    pickOne: "Pick a review",
    pickOneBody: "Choose a review from the queue to draft a reply.",
    noText: "Star rating only, no written review.",
    repliedOnGoogle: "Already answered on Google",
    openInGoogle: "Open in Google Maps",
    drafts: "AI drafts",
    draftsHint: "Three registers. Pick one, edit it, or write your own.",
    generate: "Draft replies",
    regenerate: "Draft again",
    generating: "Writing",
    useDraft: "Use this",
    yourReply: "Reply to publish",
    replyPlaceholder: "Pick a draft above, or write the reply yourself.",
    copyReply: "Copy and mark replied",
    copyOnly: "Copy",
    copied: "Copied",
    markReplied: "Mark replied",
    skip: "Skip",
    reopen: "Reopen",
    extraInstruction: "Steer the draft (optional)",
    extraPlaceholder: "e.g. mention that the bakery restocks at 4pm",
    aiOff: "AI drafts are off",
    aiOffBody: "Add OPENROUTER_API_KEY to .env.local and restart the server.",
    genFailed: "Couldn't write the drafts",
    replySaved: "Reply saved",
    emptyReply: "Write or pick a reply first.",
    statusNew: "New",
    statusInProgress: "In progress",
    statusReplied: "Replied",
    statusSkipped: "Skipped",
    of: "of",
  },

  tone: {
    standard: "Standard",
    empathetic: "Warmer",
    brief: "Short",
  },

  locations: {
    title: "Stores",
    subtitle: "Grouped by zone, worst rated first inside each — that's where the work is.",
    code: "Code",
    store: "Store",
    spread: "Star spread",
    rating: "Rating",
    reviews: "Reviews",
    unanswered: "To answer",
    backToStores: "All stores",
    recentReviews: "Recent reviews",
    answerThese: "Answer this store's reviews",
    search: "Search by name, city or street",
    allZones: "All zones",
    zone: "Zone",
    noMatches: "No store matches",
    noMatchesBody: "Try a different name, city or street.",
    clear: "Clear",
    showing: "Showing",
  },

  settings: {
    title: "Settings",
    voiceTitle: "Brand voice",
    voiceHint: "Folded into every AI prompt. Hard rules about honesty and language can't be overridden here.",
    companyName: "Company name",
    guidelines: "Voice guidelines",
    contactChannel: "Contact channel",
    contactHint: "Left empty, replies won't offer a phone number or link. The model is told never to invent one.",
    signature: "Sign-off",
    signatureHint: "Empty means no sign-off.",
    maxSentences: "Longest reply (sentences)",
    sourceTitle: "Review source",
    sourceHint: "Set with REVIEW_SOURCE in your environment.",
    sourceActive: "Active source",
    configured: "Configured",
    notConfigured: "Not configured",
    aiTitle: "AI model",
    aiHint: "Set with OPENROUTER_MODEL. Any model slug OpenRouter supports.",
    model: "Model",
    syncHistory: "Recent syncs",
    noSyncs: "No syncs recorded yet.",
  },

  topics: {
    queues: "Queues and waiting",
    staff: "Staff",
    pricing: "Prices and promotions",
    price_mismatch: "Shelf price mismatch",
    cleanliness: "Cleanliness",
    freshness: "Freshness and expiry",
    assortment: "Stock and range",
    hours: "Opening hours",
    loyalty: "Loyalty card and app",
    checkout_tech: "Checkout and payment",
  } satisfies Record<Topic, string>,

  zones: {
    "chisinau-centru": "Chișinău — Centru",
    "chisinau-botanica": "Chișinău — Botanica",
    "chisinau-ciocana": "Chișinău — Ciocana",
    "chisinau-riscani": "Chișinău — Râșcani",
    "chisinau-buiucani": "Chișinău — Buiucani",
    nord: "North",
    "raioane-centru": "Centre (districts)",
    sud: "South",
    unassigned: "Unassigned",
  } satisfies Record<ZoneId, string>,

  zoneRegions: {
    chisinau: "Chișinău",
    regions: "Regions",
    other: "Other",
  } satisfies Record<ZoneRegion, string>,

  // Widened on purpose: English needs only one/other, but Dict is inferred from
  // this object and ro/ru need the `few` and `many` slots too.
  plurals: {
    stores: { one: "store", other: "stores" },
    reviews: { one: "review", other: "reviews" },
  } as { stores: PluralForms; reviews: PluralForms },
};

export type Dict = typeof en;

const ro: Dict = {
  brand: "Linella",
  product: "Ghișeu recenzii",

  nav: {
    dashboard: "Privire generală",
    inbox: "Recenzii",
    locations: "Magazine",
    settings: "Setări",
  },

  common: {
    loading: "Se încarcă",
    save: "Salvează",
    saved: "Salvat",
    cancel: "Anulează",
    retry: "Încearcă din nou",
    reviews: "recenzii",
    unanswered: "fără răspuns",
    all: "Toate",
    none: "Niciunul",
    search: "Caută în recenzii",
    language: "Limbă",
  },

  dashboard: {
    title: "Privire generală",
    subtitle: "Unde se adună recenziile fără răspuns, zonă cu zonă.",
    avgRating: "Rating mediu",
    totalReviews: "Recenzii urmărite",
    unanswered: "Așteaptă răspuns",
    negative: "1–2 stele, ultimele 30 de zile",
    zonesTitle: "Zone care cer atenție",
    zonesHint: "Ordonate după câte recenzii stau chiar acum fără răspuns.",
    backlogTitle: "Magazine cu cea mai mare restanță",
    backlogHint: "Magazinele concrete din spatele cifrelor pe zone.",
    zoneStores: "magazine",
    zoneWorst: "Cel mai slab",
    zoneBacklog: "Restanță",
    allCaughtUp: "Nimic în așteptare",
    allCaughtUpBody: "Toate recenziile au răspuns. Sincronizează pentru a verifica.",
    leaderboard: "Magazine după rating",
    leaderboardHint: "Bara arată repartiția pe cele cinci niveluri, nu doar media.",
    topics: "Ce reclamă clienții",
    topicsHint: "Etichete după cuvinte-cheie, ultimele 90 de zile.",
    topicMentions: "mențiuni",
    topicAvg: "medie",
    syncNow: "Sincronizează",
    syncing: "Se sincronizează",
    lastSync: "Ultima sincronizare",
    never: "niciodată",
    syncFailed: "Sincronizarea a eșuat",
    goToInbox: "Deschide recenziile",
    emptyTitle: "Încă nu sunt recenzii",
    emptyBody: "Pornește o sincronizare pentru a aduce recenziile din sursa configurată.",
  },

  inbox: {
    title: "Recenzii",
    filterAll: "Toate",
    filterUnanswered: "De răspuns",
    filterNegative: "Negative",
    filterReplied: "Cu răspuns",
    filterSkipped: "Ignorate",
    allStores: "Toate magazinele",
    queueEmpty: "Nimic aici",
    queueEmptyBody: "Nicio recenzie nu corespunde filtrelor.",
    pickOne: "Alege o recenzie",
    pickOneBody: "Selectează o recenzie din listă pentru a redacta răspunsul.",
    noText: "Doar rating, fără text.",
    repliedOnGoogle: "Are deja răspuns pe Google",
    openInGoogle: "Deschide în Google Maps",
    drafts: "Variante AI",
    draftsHint: "Trei registre. Alege una, modific-o sau scrie singur.",
    generate: "Generează variante",
    regenerate: "Generează din nou",
    generating: "Se scrie",
    useDraft: "Folosește",
    yourReply: "Răspunsul de publicat",
    replyPlaceholder: "Alege o variantă de mai sus sau scrie răspunsul tău.",
    copyReply: "Copiază și marchează",
    copyOnly: "Copiază",
    copied: "Copiat",
    markReplied: "Marchează ca răspuns",
    skip: "Ignoră",
    reopen: "Redeschide",
    extraInstruction: "Ghidează varianta (opțional)",
    extraPlaceholder: "ex. menționează că panificația se reaprovizionează la ora 16",
    aiOff: "Variantele AI sunt oprite",
    aiOffBody: "Adaugă OPENROUTER_API_KEY în .env.local și repornește serverul.",
    genFailed: "Variantele nu au putut fi generate",
    replySaved: "Răspuns salvat",
    emptyReply: "Scrie sau alege mai întâi un răspuns.",
    statusNew: "Nouă",
    statusInProgress: "În lucru",
    statusReplied: "Cu răspuns",
    statusSkipped: "Ignorată",
    of: "din",
  },

  tone: {
    standard: "Standard",
    empathetic: "Mai cald",
    brief: "Scurt",
  },

  locations: {
    title: "Magazine",
    subtitle: "Grupate pe zone, cele slabe primele în fiecare — acolo e treaba.",
    code: "Cod",
    store: "Magazin",
    spread: "Repartiție",
    rating: "Rating",
    reviews: "Recenzii",
    unanswered: "De răspuns",
    backToStores: "Toate magazinele",
    recentReviews: "Recenzii recente",
    answerThese: "Răspunde la recenziile acestui magazin",
    search: "Caută după nume, oraș sau stradă",
    allZones: "Toate zonele",
    zone: "Zonă",
    noMatches: "Niciun magazin găsit",
    noMatchesBody: "Încearcă alt nume, oraș sau stradă.",
    clear: "Șterge",
    showing: "Afișate",
  },

  settings: {
    title: "Setări",
    voiceTitle: "Tonul brandului",
    voiceHint: "Se adaugă la fiecare prompt. Regulile stricte despre onestitate și limbă nu pot fi anulate de aici.",
    companyName: "Numele companiei",
    guidelines: "Indicații de ton",
    contactChannel: "Canal de contact",
    contactHint: "Lăsat gol, răspunsurile nu vor oferi telefon sau link. Modelul are interdicție să inventeze unul.",
    signature: "Semnătură",
    signatureHint: "Gol înseamnă fără semnătură.",
    maxSentences: "Lungime maximă (propoziții)",
    sourceTitle: "Sursa recenziilor",
    sourceHint: "Se setează cu REVIEW_SOURCE în mediu.",
    sourceActive: "Sursă activă",
    configured: "Configurată",
    notConfigured: "Neconfigurată",
    aiTitle: "Model AI",
    aiHint: "Se setează cu OPENROUTER_MODEL. Orice model din OpenRouter.",
    model: "Model",
    syncHistory: "Sincronizări recente",
    noSyncs: "Nicio sincronizare înregistrată.",
  },

  topics: {
    queues: "Cozi și așteptare",
    staff: "Personal",
    pricing: "Prețuri și promoții",
    price_mismatch: "Preț diferit la casă",
    cleanliness: "Curățenie",
    freshness: "Prospețime și termen",
    assortment: "Stoc și sortiment",
    hours: "Program",
    loyalty: "Card și aplicație",
    checkout_tech: "Case și plată",
  },

  zones: {
    "chisinau-centru": "Chișinău — Centru",
    "chisinau-botanica": "Chișinău — Botanica",
    "chisinau-ciocana": "Chișinău — Ciocana",
    "chisinau-riscani": "Chișinău — Râșcani",
    "chisinau-buiucani": "Chișinău — Buiucani",
    nord: "Nord",
    "raioane-centru": "Centru (raioane)",
    sud: "Sud",
    unassigned: "Nealocat",
  },

  zoneRegions: {
    chisinau: "Chișinău",
    regions: "Regiuni",
    other: "Altele",
  },

  plurals: {
    stores: { one: "magazin", few: "magazine", other: "de magazine" },
    reviews: { one: "recenzie", few: "recenzii", other: "de recenzii" },
  },
};

const ru: Dict = {
  brand: "Linella",
  product: "Отзывы",

  nav: {
    dashboard: "Обзор",
    inbox: "Входящие",
    locations: "Магазины",
    settings: "Настройки",
  },

  common: {
    loading: "Загрузка",
    save: "Сохранить",
    saved: "Сохранено",
    cancel: "Отмена",
    retry: "Повторить",
    reviews: "отзывов",
    unanswered: "без ответа",
    all: "Все",
    none: "Нет",
    search: "Поиск по отзывам",
    language: "Язык",
  },

  dashboard: {
    title: "Обзор",
    subtitle: "Где копятся неотвеченные отзывы, по зонам.",
    avgRating: "Средний рейтинг",
    totalReviews: "Отзывов отслеживается",
    unanswered: "Ждут ответа",
    negative: "1–2 звезды, за 30 дней",
    zonesTitle: "Зоны, требующие внимания",
    zonesHint: "По количеству отзывов, которые прямо сейчас ждут ответа.",
    backlogTitle: "Магазины с самой большой очередью",
    backlogHint: "Конкретные магазины за цифрами по зонам.",
    zoneStores: "магазинов",
    zoneWorst: "Слабейший",
    zoneBacklog: "Очередь",
    allCaughtUp: "Ничего не ждёт",
    allCaughtUpBody: "На все отзывы есть ответ. Синхронизируйте, чтобы проверить.",
    leaderboard: "Магазины по рейтингу",
    leaderboardHint: "Полоса показывает распределение по пяти уровням, а не только среднее.",
    topics: "О чём пишут покупатели",
    topicsHint: "Метки по ключевым словам за последние 90 дней.",
    topicMentions: "упоминаний",
    topicAvg: "средн.",
    syncNow: "Синхронизировать",
    syncing: "Синхронизация",
    lastSync: "Последняя синхронизация",
    never: "никогда",
    syncFailed: "Синхронизация не удалась",
    goToInbox: "Открыть входящие",
    emptyTitle: "Отзывов пока нет",
    emptyBody: "Запустите синхронизацию, чтобы загрузить отзывы из выбранного источника.",
  },

  inbox: {
    title: "Входящие",
    filterAll: "Все",
    filterUnanswered: "Ответить",
    filterNegative: "Негативные",
    filterReplied: "Отвечено",
    filterSkipped: "Пропущено",
    allStores: "Все магазины",
    queueEmpty: "Пусто",
    queueEmptyBody: "Ни один отзыв не подходит под фильтры.",
    pickOne: "Выберите отзыв",
    pickOneBody: "Выберите отзыв из списка, чтобы составить ответ.",
    noText: "Только оценка, без текста.",
    repliedOnGoogle: "Уже отвечено в Google",
    openInGoogle: "Открыть в Google Картах",
    drafts: "Варианты AI",
    draftsHint: "Три регистра. Выберите, отредактируйте или напишите свой.",
    generate: "Составить ответы",
    regenerate: "Составить заново",
    generating: "Пишем",
    useDraft: "Взять",
    yourReply: "Ответ к публикации",
    replyPlaceholder: "Выберите вариант выше или напишите ответ сами.",
    copyReply: "Копировать и отметить",
    copyOnly: "Копировать",
    copied: "Скопировано",
    markReplied: "Отметить отвеченным",
    skip: "Пропустить",
    reopen: "Вернуть",
    extraInstruction: "Направить вариант (необязательно)",
    extraPlaceholder: "напр. упомянуть, что выпечку довозят в 16:00",
    aiOff: "Варианты AI отключены",
    aiOffBody: "Добавьте OPENROUTER_API_KEY в .env.local и перезапустите сервер.",
    genFailed: "Не удалось составить варианты",
    replySaved: "Ответ сохранён",
    emptyReply: "Сначала напишите или выберите ответ.",
    statusNew: "Новый",
    statusInProgress: "В работе",
    statusReplied: "Отвечено",
    statusSkipped: "Пропущено",
    of: "из",
  },

  tone: {
    standard: "Стандартный",
    empathetic: "Теплее",
    brief: "Коротко",
  },

  locations: {
    title: "Магазины",
    subtitle: "Сгруппированы по зонам, слабые сверху внутри каждой — там и работа.",
    code: "Код",
    store: "Магазин",
    spread: "Распределение",
    rating: "Рейтинг",
    reviews: "Отзывы",
    unanswered: "Ответить",
    backToStores: "Все магазины",
    recentReviews: "Недавние отзывы",
    answerThese: "Ответить на отзывы этого магазина",
    search: "Поиск по названию, городу или улице",
    allZones: "Все зоны",
    zone: "Зона",
    noMatches: "Магазин не найден",
    noMatchesBody: "Попробуйте другое название, город или улицу.",
    clear: "Очистить",
    showing: "Показано",
  },

  settings: {
    title: "Настройки",
    voiceTitle: "Голос бренда",
    voiceHint: "Добавляется в каждый запрос. Жёсткие правила о честности и языке отсюда не отключаются.",
    companyName: "Название компании",
    guidelines: "Указания по тону",
    contactChannel: "Канал связи",
    contactHint: "Если пусто, ответы не предложат телефон или ссылку. Модели запрещено их выдумывать.",
    signature: "Подпись",
    signatureHint: "Пусто — без подписи.",
    maxSentences: "Максимум предложений",
    sourceTitle: "Источник отзывов",
    sourceHint: "Задаётся переменной REVIEW_SOURCE.",
    sourceActive: "Активный источник",
    configured: "Настроен",
    notConfigured: "Не настроен",
    aiTitle: "Модель AI",
    aiHint: "Задаётся переменной OPENROUTER_MODEL. Любая модель OpenRouter.",
    model: "Модель",
    syncHistory: "Последние синхронизации",
    noSyncs: "Синхронизаций пока не было.",
  },

  topics: {
    queues: "Очереди и ожидание",
    staff: "Персонал",
    pricing: "Цены и акции",
    price_mismatch: "Цена не совпадает",
    cleanliness: "Чистота",
    freshness: "Свежесть и сроки",
    assortment: "Наличие и ассортимент",
    hours: "Часы работы",
    loyalty: "Карта и приложение",
    checkout_tech: "Кассы и оплата",
  },

  zones: {
    "chisinau-centru": "Кишинёв — Центр",
    "chisinau-botanica": "Кишинёв — Ботаника",
    "chisinau-ciocana": "Кишинёв — Чеканы",
    "chisinau-riscani": "Кишинёв — Рышкановка",
    "chisinau-buiucani": "Кишинёв — Буюканы",
    nord: "Север",
    "raioane-centru": "Центр (районы)",
    sud: "Юг",
    unassigned: "Не назначено",
  },

  zoneRegions: {
    chisinau: "Кишинёв",
    regions: "Регионы",
    other: "Прочее",
  },

  plurals: {
    stores: {
      one: "магазин",
      few: "магазина",
      many: "магазинов",
      other: "магазина",
    },
    reviews: { one: "отзыв", few: "отзыва", many: "отзывов", other: "отзыва" },
  },
};

const DICTS: Record<Locale, Dict> = { en, ro, ru };

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Romanian and Russian both need real plural rules — "1 magazine" and
 * "1 recenzii" are the kind of thing a native speaker notices immediately.
 * Intl.PluralRules already knows both languages; the dictionaries just supply
 * the word forms. Romanian's `other` form carries its "de" (20 de magazine).
 */
export type PluralForms = {
  one: string;
  few?: string;
  many?: string;
  other: string;
};

export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(locale).select(count);
  const word = forms[rule as keyof PluralForms] ?? forms.other;
  return `${count} ${word}`;
}

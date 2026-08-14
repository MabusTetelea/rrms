import type { SourceLocation } from "./types";

/**
 * Demo dataset used by the `mock` source so the app is fully usable before any
 * paid API key exists. Store addresses are plausible Chișinău/regional
 * locations, not scraped data — replace with the real place IDs when you
 * switch REVIEW_SOURCE to a live provider.
 */

export const MOCK_LOCATIONS: SourceLocation[] = [
  {
    externalId: "mock-ciocana",
    name: "Linella — Ciocana",
    address: "bd. Mircea cel Bătrân 9, Chișinău",
    city: "Chișinău",
    lat: 47.0512,
    lng: 28.8935,
  },
  {
    externalId: "mock-botanica",
    name: "Linella — Botanica",
    address: "bd. Dacia 32, Chișinău",
    city: "Chișinău",
    lat: 46.9846,
    lng: 28.8672,
  },
  {
    externalId: "mock-riscani",
    name: "Linella — Râșcani",
    address: "str. Kiev 7, Chișinău",
    city: "Chișinău",
    lat: 47.0489,
    lng: 28.8514,
  },
  {
    externalId: "mock-buiucani",
    name: "Linella — Buiucani",
    address: "str. Alba Iulia 75, Chișinău",
    city: "Chișinău",
    lat: 47.0301,
    lng: 28.7862,
  },
  {
    externalId: "mock-centru",
    name: "Linella — Centru",
    address: "bd. Ștefan cel Mare 128, Chișinău",
    city: "Chișinău",
    lat: 47.0246,
    lng: 28.8324,
  },
  {
    externalId: "mock-telecentru",
    name: "Linella — Telecentru",
    address: "str. Sihastrului 15, Chișinău",
    city: "Chișinău",
    lat: 47.0021,
    lng: 28.8083,
  },
  {
    externalId: "mock-durlesti",
    name: "Linella — Durlești",
    address: "str. Cartușa 4, Durlești",
    city: "Durlești",
    lat: 47.0234,
    lng: 28.7524,
  },
  {
    externalId: "mock-balti",
    name: "Linella — Bălți",
    address: "str. Independenței 20, Bălți",
    city: "Bălți",
    lat: 47.7615,
    lng: 27.9291,
  },
  {
    externalId: "mock-orhei",
    name: "Linella — Orhei",
    address: "str. Vasile Lupu 36, Orhei",
    city: "Orhei",
    lat: 47.3831,
    lng: 28.8231,
  },
  {
    externalId: "mock-cahul",
    name: "Linella — Cahul",
    address: "str. Ștefan cel Mare 4, Cahul",
    city: "Cahul",
    lat: 45.9075,
    lng: 28.1944,
  },
  {
    externalId: "mock-ungheni",
    name: "Linella — Ungheni",
    address: "str. Națională 15, Ungheni",
    city: "Ungheni",
    lat: 47.2089,
    lng: 27.8006,
  },
  {
    externalId: "mock-ialoveni",
    name: "Linella — Ialoveni",
    address: "str. Alexandru cel Bun 41, Ialoveni",
    city: "Ialoveni",
    lat: 46.9412,
    lng: 28.7778,
  },
];

export const MOCK_AUTHORS_RO = [
  "Andrei Ciobanu",
  "Maria Rusu",
  "Ion Popescu",
  "Cristina Vasilache",
  "Vasile Munteanu",
  "Elena Cebotari",
  "Dumitru Balan",
  "Ana Grosu",
  "Sergiu Lungu",
  "Natalia Bejan",
  "Mihai Rotaru",
  "Doina Sîrbu",
  "Victor Guțu",
  "Liliana Croitoru",
  "Radu Postolache",
];

export const MOCK_AUTHORS_RU = [
  "Ольга Кириллова",
  "Дмитрий Соколов",
  "Ирина Морозова",
  "Александр Ковалёв",
  "Татьяна Волкова",
  "Сергей Петров",
  "Людмила Ткаченко",
  "Виктор Романенко",
  "Светлана Гончарова",
  "Николай Ивашко",
  "Анна Лебедева",
  "Павел Дьяченко",
];

type Corpus = { ro: string[]; ru: string[] };

/** Review bodies grouped by star rating. */
export const MOCK_REVIEW_TEXTS: Record<1 | 2 | 3 | 4 | 5, Corpus> = {
  1: {
    ro: [
      "Cozi enorme la case. Din șase case erau deschise doar două, am stat 25 de minute pentru trei produse. Inacceptabil la ora de vârf.",
      "Am cumpărat iaurt expirat de două zile. Verificați termenele de valabilitate pe raft, nu e prima dată.",
      "Casiera a fost extrem de nepoliticoasă, mi-a aruncat restul pe tejghea fără un cuvânt. Nu mai revin în acest magazin.",
      "Prețul de pe raft nu corespunde cu cel de la casă. Am reclamat și mi s-a spus că „așa e în sistem”. Practic înșelătoare.",
      "Carne cu miros suspect la raftul refrigerat. Am semnalat unui angajat și a ridicat din umeri.",
      "Podeaua era udă fără niciun semn de avertizare, era să cad cu copilul de mână.",
    ],
    ru: [
      "Огромная очередь на кассе, работала одна касса из шести. Простояла почти полчаса из-за трёх товаров.",
      "Купила творог с истёкшим сроком годности. Следите за датами на полках, это уже не первый раз.",
      "Кассир нахамила и бросила сдачу на стойку. Больше сюда не приду.",
      "Цена на ценнике и на кассе не совпадает. На жалобу ответили, что «так в системе». Это обман покупателя.",
      "В холодильнике мясо с неприятным запахом. Сказала сотруднику — он просто пожал плечами.",
    ],
  },
  2: {
    ro: [
      "Magazinul e aproape de casă, dar rafturile sunt des goale seara. Pâinea se termină după ora 19.",
      "Prea puține case deschise. Produsele sunt ok, dar așteptarea strică totul.",
      "Zona de legume arată neîngrijită, multe produse ofilite. Prețurile nu justifică calitatea.",
      "Am cerut ajutor să găsesc un produs și angajatul mi-a arătat vag cu mâna spre celălalt capăt al magazinului.",
    ],
    ru: [
      "Магазин рядом с домом, но вечером полки пустые. Хлеб заканчивается уже после семи.",
      "Мало открытых касс. Товары нормальные, но ожидание всё портит.",
      "Овощной отдел выглядит неухоженно, много вялого товара при таких ценах.",
      "Попросила помочь найти товар — сотрудник просто махнул рукой в сторону другого конца зала.",
    ],
  },
  3: {
    ro: [
      "Magazin ok pentru cumpărături rapide, dar uneori lipsesc produsele de bază. Personalul e amabil.",
      "Curat și bine organizat, însă prețurile sunt puțin peste media din zonă.",
      "Nimic special, dar își face treaba. Ar ajuta o casă self-service în plus.",
      "Sortimentul de lactate e bun, la panificație lasă de dorit.",
    ],
    ru: [
      "Нормальный магазин для быстрых покупок, но иногда нет базовых товаров. Персонал вежливый.",
      "Чисто и аккуратно, но цены чуть выше средних по району.",
      "Ничего особенного, но со своей задачей справляется. Не хватает ещё одной кассы самообслуживания.",
      "Молочный отдел хороший, а выпечка так себе.",
    ],
  },
  4: {
    ro: [
      "Magazin curat, personal amabil și program lung. Scad o stea pentru cozile de weekend.",
      "Legume proaspete și prețuri corecte. Casele self-service ajută mult dimineața.",
      "Găsesc aproape tot ce am nevoie. Aș vrea un sortiment mai mare de produse fără gluten.",
      "Foarte comod, la câțiva pași de bloc. Angajații sunt săritori când întrebi ceva.",
      "Promoțiile sunt bune, aplicația de fidelitate merită. Uneori se aglomerează seara.",
    ],
    ru: [
      "Чистый магазин, вежливый персонал и удобный график. Минус звезда за очереди в выходные.",
      "Свежие овощи и адекватные цены. Кассы самообслуживания сильно выручают утром.",
      "Нахожу почти всё, что нужно. Хотелось бы больше безглютеновых товаров.",
      "Очень удобно, в двух шагах от дома. Сотрудники охотно подсказывают.",
      "Хорошие акции, карта лояльности себя оправдывает. Вечером бывает людно.",
    ],
  },
  5: {
    ro: [
      "Cel mai bun magazin din cartier. Curat, luminos, personal prietenos și mereu produse proaspete.",
      "Recomand! Am găsit tot ce căutam, casierele lucrează rapid și cu zâmbetul pe buze.",
      "Program excelent, deschis până târziu. M-a salvat de multe ori seara.",
      "Carne și brânzeturi de calitate, sortiment local foarte bun. Felicitări echipei!",
      "Am uitat portofelul și o angajată mi-a ținut coșul deoparte până m-am întors. Servicii impecabile.",
      "Prețuri bune la promoții și rafturi mereu aranjate. Continuați tot așa.",
    ],
    ru: [
      "Лучший магазин в районе. Чисто, светло, приветливый персонал и всегда свежие продукты.",
      "Рекомендую! Нашла всё, что искала, кассиры работают быстро и с улыбкой.",
      "Отличный график, открыто допоздна. Не раз выручало вечером.",
      "Качественное мясо и сыры, хороший выбор местных производителей. Спасибо команде!",
      "Забыл кошелёк, сотрудница отложила мою корзину до моего возвращения. Отличный сервис.",
      "Хорошие цены по акциям и всегда аккуратные полки. Так держать.",
    ],
  },
};

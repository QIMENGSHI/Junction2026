import type { DisplayLanguage } from "./format";

export type Language = DisplayLanguage;

export const COPY = {
  en: {
    simulatePurchase: "Simulate a purchase",
    dinner: "Dinner", taxi: "Taxi", groceries: "Groceries", dentist: "Dentist",
    purchaseAmount: "Amount (€)", addPurchase: "Add purchase", resetDemo: "Reset",
    simulated: "Simulated", simulatedCount: "{count} simulated purchases",
    updating: "Updating…", purchaseFailed: "Couldn’t update the demo. Try again.",
    simulationHelp: "Demo purchases update the shared account on all devices.",
    liveUnavailable: "Live data unavailable. Showing the last update.",
    tagline: "Your money in three baskets",
    home: "Home",
    coach: "Coach",
    language: "Suomeksi",
    newChat: "New chat",
    greeting: "How can I help?",
    intro: "I sort every euro into three baskets: regular bills, irregular surprises and everyday spending. Every number I show comes from your own transactions.",
    askPlaceholder: "Ask about your money",
    ask: "Ask",
    looking: "Kori is looking at your numbers…",
    calculationFailed: "Couldn’t run that calculation.",
    tryAnother: "Kori will try another way.",
    wentWrong: "Something went wrong.",
    overview: "Your money",
    today: "30 Sep 2026",
    homeIntro: "One clear number for the week, with every euro traceable to your transactions.",
    basketTitle: "Your three baskets",
    basketHelp: "Tap a basket to see the transactions behind it.",
    planTitle: "Try a change",
    askKori: "Ask Kori",
    safeTitle: "Safe to spend this week",
    howCalculated: "View calculation",
    close: "Close",
    calculationTitle: "Your weekly budget",
    protectedUntilPayday: "Protected until payday",
    showTransactions: "Transactions",
    hideTransactions: "Hide transactions",
    showAll: "Show all",
    noTransactions: "No transactions match.",
    loadFailed: "Couldn’t load the transactions. Try again.",
    transaction: "transaction",
    transactions: "transactions",
    perMonth: "a month",
    onAverage: "on average",
    total: "Total",
    payday: "payday",
    inDays: "in {days} days",
    cutBy: "Cut by",
    savedMonth: "Save / month",
    savedYear: "Save / year",
    spendNow: "You spend about {now} a week on this now; after the cut, {after}.",
    safeSentence: "This week’s safe-to-spend is {safe}.",
    youAndPeers: "You and people your age",
    agesPerMonth: "ages {age}, per month",
    timesAverage: "{times}× the average",
    moreThan: "more than {percent}% of {count} people",
    median: "median {amount}",
    spenderType: "Your spender type",
    tryWeek: "Try this week",
    working: "Working…",
    base: "base",
  },
  fi: {
    simulatePurchase: "Simuloi ostos",
    dinner: "Illallinen", taxi: "Taksi", groceries: "Ruokaostokset", dentist: "Hammaslääkäri",
    purchaseAmount: "Summa (€)", addPurchase: "Lisää ostos", resetDemo: "Palauta",
    simulated: "Simuloitu", simulatedCount: "{count} simuloitua ostosta",
    updating: "Päivitetään…", purchaseFailed: "Päivitys ei onnistunut. Yritä uudelleen.",
    simulationHelp: "Demo-ostokset päivittävät yhteisen tilin kaikilla laitteilla.",
    liveUnavailable: "Reaaliaikainen tieto ei ole saatavilla. Näytetään viimeisin päivitys.",
    tagline: "Rahasi kolmessa korissa",
    home: "Koti",
    coach: "Valmentaja",
    language: "In English",
    newChat: "Uusi keskustelu",
    greeting: "Miten voin auttaa?",
    intro: "Jaan jokaisen euron kolmeen koriin: säännöllisiin laskuihin, epäsäännöllisiin yllätyksiin ja arjen menoihin. Jokainen näyttämäni luku tulee omista tapahtumistasi.",
    askPlaceholder: "Kysy omasta rahankäytöstäsi",
    ask: "Kysy",
    looking: "Kori tarkistaa lukujasi…",
    calculationFailed: "Laskelma ei onnistunut.",
    tryAnother: "Kori yrittää toisella tavalla.",
    wentWrong: "Jokin meni pieleen.",
    overview: "Sinun rahasi",
    today: "30.9.2026",
    homeIntro: "Yksi selkeä viikkoluku, jonka jokainen euro voidaan jäljittää tapahtumiisi.",
    basketTitle: "Kolme koriasi",
    basketHelp: "Napauta koria nähdäksesi sen taustalla olevat tapahtumat.",
    planTitle: "Kokeile muutosta",
    askKori: "Kysy Korilta",
    safeTitle: "Viikon käyttövara",
    howCalculated: "Näytä laskelma",
    close: "Sulje",
    calculationTitle: "Viikon käyttövarasi",
    protectedUntilPayday: "Suojattu palkkapäivään asti",
    showTransactions: "Tapahtumat",
    hideTransactions: "Piilota tapahtumat",
    showAll: "Näytä kaikki",
    noTransactions: "Ei vastaavia tapahtumia.",
    loadFailed: "Tapahtumia ei voitu ladata. Yritä uudelleen.",
    transaction: "tapahtuma",
    transactions: "tapahtumaa",
    perMonth: "kuukaudessa",
    onAverage: "keskimäärin",
    total: "Yhteensä",
    payday: "palkkapäivä",
    inDays: "{days} päivän päästä",
    cutBy: "Vähennä",
    savedMonth: "Säästö kuukaudessa",
    savedYear: "Säästö vuodessa",
    spendNow: "Käytät tähän nyt noin {now} viikossa; vähennyksen jälkeen {after}.",
    safeSentence: "Tämän viikon turvallinen käyttövara on {safe}.",
    youAndPeers: "Sinä ja ikäisesi",
    agesPerMonth: "ikä {age}, kuukaudessa",
    timesAverage: "{times}× keskiarvo",
    moreThan: "enemmän kuin {percent} % ryhmän {count} ihmisestä",
    median: "mediaani {amount}",
    spenderType: "Kuluttajatyyppisi",
    tryWeek: "Kokeile tällä viikolla",
    working: "Lasketaan…",
    base: "vertailujakso",
  },
} as const;

export type CopyKey = keyof typeof COPY.en;

export function copy(language: Language, key: CopyKey, values: Record<string, string | number> = {}) {
  let text: string = COPY[language][key];
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

const FI_NAMES: Record<string, string> = {
  Spending: "Menot",
  "Money in": "Tulot",
  Saving: "Säästäminen",
  regular: "Säännölliset laskut",
  irregular: "Epäsäännölliset menot",
  everyday: "Arjen menot",
  "Regular basket": "Säännöllisten laskujen kori",
  "Irregular basket": "Epäsäännöllisten menojen kori",
  "Everyday basket": "Arjen kori",
  "Regular bills": "Säännölliset laskut",
  "Irregular costs": "Epäsäännölliset menot",
  "Everyday spending": "Arjen menot",
  Housing: "Asuminen",
  Utilities: "Sähkö ja vesi",
  Groceries: "Ruokaostokset",
  Transportation: "Liikkuminen",
  Health: "Terveys",
  "Home & Tech": "Koti ja tekniikka",
  Restaurants: "Ravintolat",
  Entertainment: "Viihde",
  Lifestyle: "Elämäntyyli",
  Travel: "Matkailu",
  Salary: "Palkka",
  "Other Income": "Muut tulot",
  Taxi: "Taksi",
  Restaurant: "Ravintola",
  "Fast food": "Pikaruoka",
  Supermarket: "Ruokakauppa",
  Electronics: "Elektroniikka",
};

export function displayName(value: string, language: Language) {
  return language === "fi" ? (FI_NAMES[value] ?? value) : value;
}

export function cardTitle(title: string, language: Language) {
  if (language === "en") return title;
  const exact: Record<string, string> = {
    "Safe to spend this week": COPY.fi.safeTitle,
    "Your spender type": COPY.fi.spenderType,
    "You and people your age": COPY.fi.youAndPeers,
  };
  if (exact[title]) return exact[title];
  const match = title.match(/^(.*) by (basket|category|type|month|weekday|merchant)$/);
  if (!match) return displayName(title, language);
  const suffix: Record<string, string> = {
    basket: "koreittain",
    category: "kategorioittain",
    type: "tyypeittäin",
    month: "kuukausittain",
    weekday: "viikonpäivittäin",
    merchant: "myyjittäin",
  };
  return `${displayName(match[1], language)} ${suffix[match[2]]}`;
}

export function safeLabel(label: string, language: Language) {
  if (language === "en") return label;
  const exact: Record<string, string> = {
    "Balance now": "Saldo nyt",
    "Irregular buffer": "Epäsäännöllisten menojen puskuri",
    "Savings goal": "Säästötavoite",
    "Left until payday": "Jäljellä palkkapäivään",
    "Safe to spend this week": COPY.fi.safeTitle,
    "Next salary": "Seuraava palkka",
    "Basket two, monthly average": "Toisen korin kuukausikeskiarvo",
  };
  if (exact[label]) return exact[label];
  const due = label.match(/^(.*) due (.+)$/);
  if (due) return `${displayName(due[1], language)} erääntyy ${dateFragmentFi(due[2])}`;
  const until = label.match(/^(.*) until payday$/);
  if (until) return `${displayName(until[1], language)} palkkapäivään asti`;
  return displayName(label, language);
}

export function safeNote(note: string, language: Language) {
  if (language === "en") return note;
  if (note.startsWith("after your last transaction")) return dateFragmentFi(note.replace("after your last transaction", "viimeisimmän tapahtuman jälkeen"));
  if (note === "your usual amount: median of the last 6 payments") return "tavallinen summa: kuuden viime maksun mediaani";
  if (note.startsWith("your own pace over the last 6 months")) return note.replace("your own pace over the last 6 months, for", "oma kuuden kuukauden tahtisi,").replace("days", "päiväksi");
  if (note.startsWith("basket two averages")) return note.replace("basket two averages", "toinen kori keskimäärin").replace("a month; this is", "kuukaudessa; tämä vastaa").replace("days of it", "päivää");
  if (note === "kept aside before payday") return "jätetään sivuun ennen palkkapäivää";
  if (note === "balance minus everything above") return "saldo miinus yllä olevat varaukset";
  if (note.startsWith("expected ")) return dateFragmentFi(note.replace("expected", "odotetaan").replace("median of the last 6 salaries", "kuuden viime palkan mediaani"));
  if (note === "irregular costs over the last 12 months, per month") return "epäsäännölliset menot 12 kuukaudelta, kuukautta kohti";
  return dateFragmentFi(note);
}

function dateFragmentFi(text: string) {
  const months: Record<string, string> = {
    Jan: "tammi", Feb: "helmi", Mar: "maalis", Apr: "huhti", May: "touko", Jun: "kesä",
    Jul: "heinä", Aug: "elo", Sep: "syys", Oct: "loka", Nov: "marras", Dec: "joulu",
  };
  return text.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,
    (_match, day: string, month: string) => `${day}. ${months[month]}`);
}

export function personaTitle(title: string, language: Language) {
  if (language === "en") return title;
  const names: Record<string, string> = {
    "Night-out spender": "Illanviettäjä",
    Shopper: "Shoppailija",
    Traveller: "Matkailija",
    "Steady saver": "Tasainen säästäjä",
    "Balanced spender": "Tasapainoinen kuluttaja",
    "Going out": "Ulkona käyminen",
    Shopping: "Ostokset",
    Travel: "Matkailu",
    Saving: "Säästäminen",
    "Everyday spending": "Arjen menot",
    "Compared with people your age": "Verrattuna ikäisiisi",
    "When you spend": "Milloin kulutat",
    "Try this week": COPY.fi.tryWeek,
  };
  return names[title] ?? displayName(title, language);
}

export function personaText(text: string, language: Language) {
  if (language === "en") return text;
  const exact: Record<string, string> = {
    "Most of your everyday money goes on going out: restaurants and entertainment.": "Suurin osa arjen menoistasi kuluu ulkona käymiseen: ravintoloihin ja viihteeseen.",
    "Clothes, gadgets and things for home are your biggest everyday spend.": "Vaatteet, laitteet ja kodin hankinnat ovat suurin arjen menoryhmäsi.",
    "Trips take the largest share of your everyday spending.": "Matkat vievät suurimman osuuden arjen menoistasi.",
    "You save a good share of your income and keep everyday spending low.": "Säästät hyvän osuuden tuloistasi ja pidät arjen menot matalina.",
    "Your everyday spending is spread out; no single habit dominates.": "Arjen menosi jakautuvat tasaisesti ilman yhtä hallitsevaa tapaa.",
  };
  if (exact[text]) return exact[text];
  if (text.startsWith("Restaurants and entertainment:")) return text.replace("Restaurants and entertainment:", "Ravintolat ja viihde:").replace("a month", "kuukaudessa").replace("of your everyday spending", "arjen menoistasi");
  if (text.includes("the average for ages")) return text.replace(/^([^:]+):/, (value) => `${displayName(value.slice(0, -1), language)}:`).replace("a month", "kuukaudessa").replace("the average for ages", "ikäryhmän keskiarvo");
  if (text.includes("of your everyday spending happens after 6 pm")) return text.replace("of your everyday spending happens after 6 pm", "arjen menoistasi syntyy kello 18 jälkeen");
  if (text.includes("of your everyday spending happens at weekends")) return text.replace("of your everyday spending happens at weekends", "arjen menoistasi syntyy viikonloppuisin");
  if (text.startsWith("Skip one restaurant visit")) return text.replace("Skip one restaurant visit this week", "Jätä yksi ravintolakäynti väliin tällä viikolla").replace("you average", "käyt keskimäärin").replace("a week at", "kertaa viikossa, keskihintaan").replace("each. One fewer every week keeps about", ". Yksi vähemmän viikossa säästää noin").replace("a month", "kuukaudessa");
  return text;
}

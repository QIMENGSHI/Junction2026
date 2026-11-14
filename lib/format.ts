// Display formatting shared by server and browser. Formatting only: no arithmetic on figures.

export type DisplayLanguage = "en" | "fi";

const EUR = {
  en: new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }),
  fi: new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }),
};
const EUR_ROUND = {
  en: new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
  fi: new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
};

export const eur = (value: number, language: DisplayLanguage = "en") => EUR[language].format(value);
export const eurRound = (value: number, language: DisplayLanguage = "en") => EUR_ROUND[language].format(value);

const MONTH = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  fi: ["tammi", "helmi", "maalis", "huhti", "touko", "kesä", "heinä", "elo", "syys", "loka", "marras", "joulu"],
};
const MONTH_LONG = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December"],
  fi: ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu",
    "syyskuu", "lokakuu", "marraskuu", "joulukuu"],
};

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, last: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/** "2026-09-30" -> "30 Sep 2026" (read as a calendar date, never shifted by a time zone). */
export function dayLabel(iso: string, withYear = true, language: DisplayLanguage = "en"): string {
  const { y, m, d } = parts(iso);
  return language === "fi"
    ? `${d}. ${MONTH[language][m - 1]}${withYear ? ` ${y}` : ""}`
    : `${d} ${MONTH[language][m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** A date range in words: "September 2026", "Oct 2024 – Sep 2026", "1–14 Sep 2026". */
export function periodLabel(start: string, end: string, language: DisplayLanguage = "en"): string {
  const a = parts(start);
  const b = parts(end);
  const wholeMonths = a.d === 1 && b.d === b.last;
  if (wholeMonths && a.y === b.y && a.m === b.m) return `${MONTH_LONG[language][a.m - 1]} ${a.y}`;
  if (wholeMonths) {
    return a.y === b.y
      ? `${MONTH[language][a.m - 1]} – ${MONTH[language][b.m - 1]} ${b.y}`
      : `${MONTH[language][a.m - 1]} ${a.y} – ${MONTH[language][b.m - 1]} ${b.y}`;
  }
  if (start === end) return dayLabel(start, true, language);
  if (a.y === b.y && a.m === b.m) {
    return language === "fi"
      ? `${a.d}.–${b.d}. ${MONTH[language][a.m - 1]} ${a.y}`
      : `${a.d}–${b.d} ${MONTH[language][a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y) return `${dayLabel(start, false, language)} – ${dayLabel(end, true, language)}`;
  return `${dayLabel(start, true, language)} – ${dayLabel(end, true, language)}`;
}

/** "2026-09" -> "September 2026" */
export function monthLabel(key: string, language: DisplayLanguage = "en"): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LONG[language][m - 1]} ${y}`;
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

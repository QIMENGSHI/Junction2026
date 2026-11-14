import { eur, periodLabel } from "../lib/format";
import { cardTitle, copy, safeLabel, safeNote } from "../lib/i18n";

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : ` (got ${String(got)})`}`);
}

check("Finnish weekly title stays compact", copy("fi", "safeTitle") === "Viikon käyttövara", copy("fi", "safeTitle"));
check("Finnish money uses comma decimals and trailing euro", eur(467.4, "fi").includes("467,40") && eur(467.4, "fi").trim().endsWith("€"), eur(467.4, "fi"));
check("Finnish month range is localized", periodLabel("2026-09-01", "2026-09-30", "fi") === "syyskuu 2026", periodLabel("2026-09-01", "2026-09-30", "fi"));
check("safe-to-spend due date is localized", safeLabel("Housing due 6 Oct", "fi") === "Asuminen erääntyy 6. loka", safeLabel("Housing due 6 Oct", "fi"));
check("salary note date is localized", safeNote("expected 15 Oct: median of the last 6 salaries", "fi").includes("15. loka"));
check("basket chart title is localized", cardTitle("Spending by basket", "fi") === "Menot koreittain", cardTitle("Spending by basket", "fi"));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall display-language checks passed");
process.exit(failed ? 1 : 0);

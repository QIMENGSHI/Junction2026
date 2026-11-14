"use client";

import type { Card } from "@/lib/protocol";
import { BenchmarkCard, CutCard, ProfileCard } from "./coach-cards";
import { BarsCard, NumberCard, SafeCard } from "./money-cards";
import { TransactionsCard } from "./transactions";
import { useLanguage } from "../language-provider";

/** Renders one tool result. The tool decides the card; the card shows only the tool's figures. */
export function CardView({ card }: { card: Card }) {
  switch (card.kind) {
    case "number": return <NumberCard card={card} />;
    case "bars": return <BarsCard card={card} />;
    case "safe_to_spend": return <SafeCard card={card} />;
    case "transactions": return <TransactionsCard card={card} />;
    case "cut": return <CutCard card={card} />;
    case "benchmark": return <BenchmarkCard card={card} />;
    case "profile": return <ProfileCard card={card} />;
  }
}

export function CardFrame({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="kori-card">
      <header className="mb-4">
        <h2 className="text-lg font-bold leading-snug text-accent">{title}</h2>
        {meta && <p className="mt-1 text-xs leading-snug text-muted">{meta}</p>}
      </header>
      {children}
    </section>
  );
}

const WORKING: Record<string, string> = {
  spend_by: "Adding up your transactions…",
  safe_to_spend: "Working out what is safe to spend…",
  simulate_cut: "Running the what-if…",
  benchmark: "Comparing with people your age…",
  spender_profile: "Reading your spending habits…",
  list_transactions: "Finding the transactions…",
};

const WORKING_FI: Record<string, string> = {
  spend_by: "Lasketaan tapahtumia yhteen…",
  safe_to_spend: "Lasketaan turvallista käyttövaraa…",
  simulate_cut: "Kokeillaan muutosta…",
  benchmark: "Verrataan ikäisiisi…",
  spender_profile: "Tulkitaan kulutustapojasi…",
  list_transactions: "Haetaan tapahtumia…",
};

export function PendingCard({ tool }: { tool: string }) {
  const { language, t } = useLanguage();
  return (
    <section aria-busy="true" className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{(language === "fi" ? WORKING_FI : WORKING)[tool] ?? t("working")}</p>
      <div className="mt-3 h-10 w-1/2 animate-pulse rounded-lg bg-wash" />
    </section>
  );
}

const BASKET_COLOR: Record<string, string> = {
  regular: "var(--basket-regular)",
  irregular: "var(--basket-irregular)",
  everyday: "var(--basket-everyday)",
};

/** A basket keeps its color everywhere; anything else is one series in the accent color. */
export const basketColor = (basket?: string | null) => (basket && BASKET_COLOR[basket]) || "var(--accent)";

const BASKET_NAME: Record<string, string> = {
  regular: "Regular bills",
  irregular: "Irregular costs",
  everyday: "Everyday spending",
};

export const groupName = (key: string) => BASKET_NAME[key] ?? key;

"use client";

import { useState } from "react";
import { eur, periodLabel } from "@/lib/format";
import { displayName, personaText, personaTitle } from "@/lib/i18n";
import type { BenchmarkCard as BenchmarkCardData, CutCard as CutCardData, ProfileCard as ProfileCardData } from "@/lib/protocol";
import { useLanguage } from "../language-provider";
import { CardFrame } from "./card-view";
import { ShowTransactions } from "./transactions";

/** The slider picks among values the SQL already computed for every 5% step, so moving it does
 *  no arithmetic in the browser. Until it moves, the card shows the exact percentage asked for. */
export function CutCard({ card, why, badge }: { card: CutCardData; why?: string; badge?: string }) {
  const { language, t } = useLanguage();
  const [step, setStep] = useState<number | null>(null);
  const at = step === null
    ? { pct: card.cut_pct, monthly: card.monthly_saving, yearly: card.yearly_saving, weekly: card.weekly_after }
    : {
        pct: card.pct_steps[step],
        monthly: card.monthly_saving_steps[step],
        yearly: card.yearly_saving_steps[step],
        weekly: card.weekly_after_steps[step],
      };
  const nearest = card.pct_steps.indexOf(Math.round(card.cut_pct / 5) * 5); // slider position only

  return (
    <CardFrame
      title={`${displayName(card.title, language)} · ${t("planTitle")}`}
      meta={periodLabel(card.period_start, card.period_end, language)}>
      {(badge || why) && <div className="mb-4">
        {badge && <p className="mb-2 w-fit rounded-full bg-wash px-2 py-1 text-xs font-semibold text-accent">{badge}</p>}
        {why && <p className="text-sm leading-snug text-ink-2">{why}</p>}
      </div>}
      <p className="mb-3 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{t("spendingPerMonth")}</span>
        <span className="money-col font-semibold">{eur(card.monthly_now, language)}</span>
      </p>
      {!!card.simulated_purchases && <p className="mb-3 w-fit rounded-full bg-wash px-2 py-1 text-xs font-semibold text-accent">
        {t(card.simulated_purchases === 1 ? "simulatedSingle" : "simulatedCount", { count: card.simulated_purchases })}
      </p>}
      <label className="block">
        <span className="flex items-baseline justify-between text-sm">
          <span>{t("cutBy")}</span>
          <span className="text-2xl font-semibold">{at.pct}%</span>
        </span>
        <input type="range" min={0} max={card.pct_steps.length - 1} step={1} value={step ?? nearest}
          onChange={(event) => setStep(Number(event.target.value))}
          aria-valuetext={`${at.pct} ${language === "fi" ? "prosenttia" : "percent"}`} className="mt-2 w-full accent-[var(--accent)]" />
      </label>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted">{t("savedMonth")}</dt>
          <dd className="mt-1 text-2xl font-bold tracking-tight text-accent">{eur(at.monthly, language)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("savedYear")}</dt>
          <dd className="mt-1 text-2xl font-bold tracking-tight text-accent">{eur(at.yearly, language)}</dd>
        </div>
      </dl>
      <details className="mt-4 text-xs text-muted">
        <summary className="cursor-pointer py-2">{t("weeklyEquivalent")}</summary>
        <p className="py-2 leading-relaxed">{t("spendNow", { now: eur(card.weekly_now, language), after: eur(at.weekly, language) })}</p>
      </details>
      <ShowTransactions ids={card.tx_ids} />
    </CardFrame>
  );
}

export function BenchmarkCard({ card }: { card: BenchmarkCardData }) {
  const { language, t } = useLanguage();
  return (
    <CardFrame title={t("youAndPeers")} meta={card.rows[0] ? t("agesPerMonth", { age: card.rows[0].age_band }) : undefined}>
      <ul className="divide-y divide-line">
        {card.rows.map((row) => {
          const longest = Math.max(row.you_per_month, row.peers_avg_per_month);
          return <li key={row.category} className="py-3">
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{displayName(row.category, language)}</span>
              <span className="money-col shrink-0">{eur(row.you_per_month, language)} <span className="text-muted">vs {eur(row.peers_avg_per_month, language)}</span></span>
            </p>
            <div className="mt-2 grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1 text-[11px] text-muted" aria-hidden="true">
              <span>{language === "fi" ? "Sinä" : "You"}</span>
              <span className="h-2 rounded-r bg-accent" style={{ width: `${longest ? (row.you_per_month / longest) * 100 : 0}%` }} />
              <span>{language === "fi" ? "Ikäryhmä" : "Age group"}</span>
              <span className="h-2 rounded-r bg-axis" style={{ width: `${longest ? (row.peers_avg_per_month / longest) * 100 : 0}%` }} />
            </div>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer py-2">{row.times_peer_avg !== null ? t("timesAverage", { times: row.times_peer_avg }) : t("howCalculated")}</summary>
              <p className="pb-2 leading-relaxed">
              {row.times_peer_avg !== null && t("timesAverage", { times: row.times_peer_avg })}
              {row.percentile !== null && ` · ${t("moreThan", { percent: row.percentile, count: row.peers_counted })}`}
              {` · ${t("median", { amount: eur(row.peers_median_per_month, language) })}`}
              </p>
            </details>
          </li>;
        })}
      </ul>
      {card.rows.length === 1 && <ShowTransactions ids={card.rows[0].tx_ids} />}
    </CardFrame>
  );
}

export function ProfileCard({ card }: { card: ProfileCardData }) {
  const { language, t } = useLanguage();
  const persona = card.rows.find((row) => row.kind === "persona");
  const evidence = card.rows.filter((row) => row.kind === "evidence");
  const habit = card.rows.find((row) => row.kind === "habit");
  return (
    <CardFrame title={t("spenderType")}>
      {persona && (
        <>
          <p className="text-2xl font-semibold">{personaTitle(persona.title, language)}</p>
          <p className="mt-1 text-sm text-ink-2">{personaText(persona.text, language)}</p>
        </>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {evidence.map((row) => (
          <li key={row.key} className="text-sm">
            <span className="font-medium">{personaTitle(row.title, language)}.</span> {personaText(row.text, language)}
          </li>
        ))}
      </ul>
      {habit && (
        <p className="mt-3 rounded-xl bg-wash px-3 py-2 text-sm">
          <span className="font-medium">{personaTitle(habit.title, language)}:</span> {personaText(habit.text, language)}
        </p>
      )}
    </CardFrame>
  );
}

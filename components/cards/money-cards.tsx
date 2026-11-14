"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dayLabel, eur, eurRound, monthLabel, periodLabel } from "@/lib/format";
import { cardTitle, displayName, safeLabel, safeNote } from "@/lib/i18n";
import type { BarsCard as BarsCardData, NumberCard as NumberCardData, SafeCard as SafeCardData, SpendRow } from "@/lib/protocol";
import { BottomSheet } from "../bottom-sheet";
import { useLanguage } from "../language-provider";
import { basketColor, CardFrame, groupName } from "./card-view";
import { ShowTransactions, signedEur, TransactionList } from "./transactions";

/** One figure: the hero number, what it covers, and the transactions behind it. */
export function NumberCard({ card }: { card: NumberCardData }) {
  const { language, t } = useLanguage();
  const severalMonths = card.period.months > 1;
  return (
    <CardFrame title={cardTitle(card.title, language)} meta={periodLabel(card.period.start, card.period.end, language)}>
      <p className="text-5xl font-semibold tracking-tight">{eur(card.eur, language)}</p>
      <p className="mt-1 text-sm text-ink-2">
        {card.n} {t(card.n === 1 ? "transaction" : "transactions")}
        {severalMonths && ` · ${eur(card.per_month_eur, language)} ${t("perMonth")} ${t("onAverage")}`}
      </p>
      <ShowTransactions ids={card.tx_ids} />
    </CardFrame>
  );
}

/** Ranked bars: one row per group, value and share printed beside each bar (no hover needed),
 *  tap a row for its transactions - or, with onSelect (Home's flip card), hand the row on instead.
 *  Months get columns instead. */
export function BarsCard({ card, onSelect, hint }: { card: BarsCardData; onSelect?: (row: SpendRow) => void; hint?: string }) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState<string | null>(null);
  if (card.group_by === "month") return <MonthColumns card={card} />;

  const perMonth = card.period.months > 1 && card.group_by !== "weekday";
  const value = (row: SpendRow) => (perMonth ? row.per_month_eur : row.eur);
  const color = (row: SpendRow) => basketColor(card.group_by === "basket" ? row.key : card.basket);

  return (
    <CardFrame title={card.group_by === "basket" ? t("basketTitle") : cardTitle(card.title, language)} meta={`${perMonth ? `${t("monthlyAverage")} · ` : ""}${periodLabel(card.period.start, card.period.end, language)}`}>
      {card.rows.length === 0 && <p className="text-sm text-ink-2">{language === "fi" ? "Ei menoja tällä jaksolla." : "Nothing in this period."}</p>}
      <ul className="flex flex-col gap-1">
        {card.rows.map((row) => (
          <li key={row.key}>
            <button type="button" data-key={row.key}
              onClick={() => (onSelect ? onSelect(row) : setOpen(open === row.key ? null : row.key))}
              aria-expanded={onSelect ? undefined : open === row.key}
              aria-label={onSelect ? t("showCategories", { basket: displayName(groupName(row.key), language) }) : undefined}
              className="min-h-16 w-full rounded-lg px-1 py-2 text-left hover:bg-wash"
              title={`${displayName(groupName(row.key), language)}: ${eur(value(row), language)}${perMonth ? ` ${t("perMonth")}` : ""}, ${row.n} ${t(row.n === 1 ? "transaction" : "transactions")}`}>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{displayName(groupName(row.key), language)}</span>
                <span className="money-col shrink-0">
                  <span className="font-medium">{eur(value(row), language)}</span>
                  {row.share_pct !== null && <span className="ml-2 inline-block w-11 text-right text-xs text-muted">{row.share_pct}%</span>}
                </span>
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-wash">
                <span className="block h-1.5 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, row.share_pct ?? 0))}%`, background: color(row) }} />
              </span>
            </button>
            {open === row.key && <div className="px-1 pb-2">
              {perMonth && <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-2 text-xs text-muted">
                <span>{t("periodTotal")} · {periodLabel(card.period.start, card.period.end, language)}</span>
                <span className="money-col shrink-0">{eur(row.eur, language)}</span>
              </p>}
              <TransactionList ids={row.tx_ids} />
            </div>}
          </li>
        ))}
      </ul>
      {perMonth && !!card.monthly_rounding_eur && <p className="mt-2 flex justify-between px-1 text-xs text-muted">
        <span>{t("rounding")}</span>
        <span className="money-col">{signedEur(card.monthly_rounding_eur, language)}</span>
      </p>}
      <p className="mt-2 flex justify-between border-t border-line px-1 pt-2 text-sm">
        <span className="text-ink-2">{t("total")}</span>
        <span className="money-col font-medium">{eur(value(card.total), language)}{perMonth && <span className="font-normal text-ink-2"> {t("perMonth")}</span>}</span>
      </p>
      {hint && <p className="mt-3 px-1 text-xs text-muted">{hint}</p>}
    </CardFrame>
  );
}

const monthTick = (key: string, language: "en" | "fi") => {
  const [y, m] = key.split("-");
  const label = new Intl.DateTimeFormat(language === "fi" ? "fi-FI" : "en-IE", { month: "short" })
    .format(new Date(Date.UTC(Number(y), Number(m) - 1, 1))).replace(".", "");
  return m === "01" ? `${label} ${y.slice(2)}` : label;
};

function MonthColumns({ card }: { card: BarsCardData }) {
  const { language, t } = useLanguage();
  const data = card.rows.map((row) => ({ key: row.key, eur: row.eur, n: row.n }));
  const color = basketColor(card.basket);
  return (
    <CardFrame title={cardTitle(card.title, language)} meta={periodLabel(card.period.start, card.period.end, language)}>
      <div className="h-48" role="img" aria-label={`${cardTitle(card.title, language)}: ${data.map((d) => `${monthTick(d.key, language)} ${eur(d.eur, language)}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="key" tickFormatter={(key: string) => monthTick(key, language)} tickLine={false} axisLine={{ stroke: "var(--axis)" }}
              tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
            <YAxis width={56} tickFormatter={(v: number) => eurRound(v, language)} tickLine={false} axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <Tooltip cursor={{ fill: "var(--wash)" }} content={({ active, payload }) => {
              const point = active && payload?.[0]?.payload as { key: string; eur: number; n: number } | undefined;
              if (!point) return null;
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
                  <p className="font-semibold">{eur(point.eur, language)}</p>
                  <p className="text-xs text-ink-2">{monthLabel(point.key, language)} · {point.n} {t("transactions")}</p>
                </div>
              );
            }} />
            <Bar dataKey="eur" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
        <span className="text-ink-2">{t("total")}</span>
        <span className="money-col font-medium">{eur(card.total.eur, language)}</span>
      </p>
      <ShowTransactions ids={card.total.tx_ids} />
    </CardFrame>
  );
}

/** The weekly number, then every line of the calculation with the transactions behind it. */
export function SafeCard({ card }: { card: SafeCardData }) {
  const { language, t } = useLanguage();
  const weekly = card.lines.find((line) => line.key === "weekly");
  const available = card.lines.find((line) => line.key === "available");
  const weeklyNote = available
    ? `${eur(available.eur, language)} ÷ ${card.days_to_payday} ${language === "fi" ? "päivää" : "days"} × 7`
    : weekly ? safeNote(weekly.note, language) : "";
  const steps = card.lines.filter((line) => line.kind !== "info" && line.key !== "weekly");
  const context = card.lines.filter((line) => line.kind === "info");
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <section className="kori-card overflow-hidden text-center">
        <h2 className="mt-1 text-base font-semibold">{t("safeTitle")}</h2>
        <p className="mt-3 text-[clamp(2.5rem,11vw,3.5rem)] font-bold leading-tight tracking-tight text-accent">{weekly ? eur(weekly.eur, language) : "–"}</p>
        <p className="mt-2 text-xs text-muted">{t("payday")} {dayLabel(card.payday, false, language)} · {t("inDays", { days: card.days_to_payday })}</p>
        <button type="button" onClick={() => setSheet(true)} className="mt-5 flex min-h-11 w-full items-center justify-between border-t border-line pt-3 text-sm font-semibold text-accent">
          {t("howCalculated")} <span aria-hidden="true">›</span>
        </button>
      </section>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t("calculationTitle")}>
        <div className="mb-2 rounded-2xl bg-surface p-4">
          <p className="text-sm text-ink-2">{t("safeTitle")}</p>
          <p className="mt-1 text-3xl font-semibold">{weekly ? eur(weekly.eur, language) : "–"}</p>
          {weekly && <p className="mt-1 text-xs text-muted">{weeklyNote}</p>}
        </div>

        <ul className="divide-y divide-line">
          {steps.map((line) => (
            <li key={`${line.key}-${line.label}`} className="py-3">
              <button type="button" disabled={line.tx_ids.length === 0}
                onClick={() => setOpen(open === line.label ? null : line.label)}
                className="flex w-full items-baseline justify-between gap-3 text-left text-sm disabled:cursor-default">
                <span className={line.kind === "result" ? "font-medium" : ""}>{safeLabel(line.label, language)}</span>
                <span className={`money-col shrink-0 ${line.kind === "result" ? "font-semibold" : ""}`}>
                  {line.kind === "minus" ? signedEur(line.eur, language) : eur(line.eur, language)}
                </span>
              </button>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {safeNote(line.note, language)}
                {line.tx_ids.length > 0 && ` · ${line.tx_ids.length} ${t(line.tx_ids.length === 1 ? "transaction" : "transactions")}`}
              </p>
              {open === line.label && <TransactionList ids={line.tx_ids} pageSize={6} />}
            </li>
          ))}
        </ul>

        {context.length > 0 && (
          <div className="mt-3 rounded-2xl bg-wash px-3 py-1">
            {context.map((line) => (
              <div key={line.key} className="flex items-start justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
                <div>
                  <p>{safeLabel(line.label, language)}</p>
                  <p className="text-xs text-muted">{safeNote(line.note, language)}</p>
                </div>
                <span className="money-col shrink-0 font-medium">{eur(line.eur, language)}</span>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </>
  );
}

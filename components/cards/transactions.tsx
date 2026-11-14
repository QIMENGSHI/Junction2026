"use client";

import { useEffect, useState } from "react";
import { dayLabel, eur, type DisplayLanguage } from "@/lib/format";
import { displayName } from "@/lib/i18n";
import type { TransactionsCard as TransactionsCardData, TxRow } from "@/lib/protocol";
import { useLanguage } from "../language-provider";
import { CardFrame } from "./card-view";

/** Money out shows with a minus, money in with a plus. */
export function signedEur(amount: number, language: DisplayLanguage = "en") {
  return amount < 0 ? `−${eur(-amount, language)}` : `+${eur(amount, language)}`;
}

export function TxRows({ rows }: { rows: TxRow[] }) {
  const { language } = useLanguage();
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.tx_id} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm">{displayName(row.label, language)}</p>
            <p className="text-xs text-muted">{dayLabel(row.date, true, language)} · {row.time} · {displayName(row.category, language)}</p>
          </div>
          <p className={`money-col shrink-0 text-sm ${row.amount_eur > 0 ? "text-good" : ""}`}>{signedEur(row.amount_eur, language)}</p>
        </li>
      ))}
    </ul>
  );
}

/** The transactions behind a figure, fetched by id from /api/transactions (screen only). */
export function TransactionList({ ids, pageSize = 8 }: { ids: number[]; pageSize?: number }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(pageSize);

  useEffect(() => {
    let alive = true;
    fetch("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { rows: TxRow[] }) => alive && setRows(data.rows))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [ids]);

  if (failed) return <p className="mt-2 text-sm text-ink-2">{t("loadFailed")}</p>;
  if (!rows) return <div className="mt-2 h-24 animate-pulse rounded-lg bg-wash" aria-busy="true" />;
  return (
    <div className="mt-2">
      <TxRows rows={rows.slice(0, shown)} />
      {rows.length > shown && (
        <button type="button" onClick={() => setShown(rows.length)} className="mt-1 text-sm font-medium text-accent">
          {t("showAll")} {rows.length}
        </button>
      )}
    </div>
  );
}

export function ShowTransactions({ ids }: { ids: number[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (ids.length === 0) return null;
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm font-medium text-accent">
        {open ? t("hideTransactions") : `${t("showTransactions")} · ${ids.length}`}
      </button>
      {open && <TransactionList ids={ids} />}
    </div>
  );
}

export function TransactionsCard({ card }: { card: TransactionsCardData }) {
  const { language, t } = useLanguage();
  return (
    <CardFrame title={displayName(card.title, language)} meta={`${card.rows.length} ${t(card.rows.length === 1 ? "transaction" : "transactions")}`}>
      {card.rows.length ? <TxRows rows={card.rows} /> : <p className="text-sm text-ink-2">{t("noTransactions")}</p>}
    </CardFrame>
  );
}

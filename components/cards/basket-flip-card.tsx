"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { type Basket, categoryColor, categoryInk, inBarOrder, isBasket } from "@/lib/category-colors";
import { eur, periodLabel } from "@/lib/format";
import { displayName } from "@/lib/i18n";
import type { BarsCard as BarsCardData, SpendRow } from "@/lib/protocol";
import { placeLabels } from "@/lib/segment-labels";
import { useLanguage } from "../language-provider";
import { groupName } from "./card-view";
import { BarsCard } from "./money-cards";
import { ShowTransactions } from "./transactions";

/** A tap on these belongs to the control, not to "flip back". */
const KEEP = "button, a, summary, input, select, textarea, label, [data-no-flip]";
const FOLD_MS = 200;
const UNFOLD_MS = 260;
const EASE_IN = "cubic-bezier(.4, 0, 1, 1)";
const EASE_OUT = "cubic-bezier(0, 0, .2, 1)";
const LABEL_FONT = "600 12px system-ui, -apple-system, 'Segoe UI', sans-serif"; // text-xs font-semibold
const LANE_ROW_PX = 18; // one 16px label line plus 2px between lane rows

let ruler: CanvasRenderingContext2D | null | undefined;
/** How wide the browser will draw a share label. Layout only: never a figure shown to anyone. */
function labelWidth(text: string) {
  if (ruler === undefined) ruler = document.createElement("canvas").getContext("2d");
  if (!ruler) return text.length * 7.5;
  ruler.font = LABEL_FONT;
  return ruler.measureText(text).width;
}

/** Home's baskets card. Tap a basket and the whole card turns over to that basket's categories;
 *  tap the back and it turns home again. One face is mounted at a time, so each keeps its own
 *  height. Every figure on both faces comes from spend_by; the browser only lays them out. */
export function BasketFlipCard({ baskets, breakdowns }: { baskets: BarsCardData; breakdowns: Record<Basket, BarsCardData> }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Basket | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const turning = useRef(false);

  const settleFocus = (next: Basket | null, previous: Basket | null) => {
    const box = wrapper.current;
    const target = next
      ? box?.querySelector<HTMLElement>("[data-flip-back]")
      : previous ? box?.querySelector<HTMLElement>(`[data-key="${previous}"]`) : null;
    target?.focus({ preventScroll: true });
  };

  const flip = async (next: Basket | null) => {
    if (turning.current || next === selected) return;
    const previous = selected;
    const card = face.current;
    const box = wrapper.current;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!card || !box || still || typeof card.animate !== "function") {
      flushSync(() => setSelected(next));
      settleFocus(next, previous);
      return;
    }
    turning.current = true;
    const way = next ? 1 : -1; // over to the back one way, home the other
    try {
      // Turn edge-on, swap the faces while the card is invisible, then turn the new face in.
      const fold = card.animate([{ transform: "rotateY(0deg)" }, { transform: `rotateY(${90 * way}deg)` }],
        { duration: FOLD_MS, easing: EASE_IN, fill: "forwards" });
      await fold.finished;
      const before = box.offsetHeight;
      flushSync(() => setSelected(next));
      const after = box.offsetHeight;
      const unfold = card.animate([{ transform: `rotateY(${-90 * way}deg)` }, { transform: "rotateY(0deg)" }],
        { duration: UNFOLD_MS, easing: EASE_OUT });
      fold.cancel(); // the unfold owns the transform from here
      // The faces differ in height: let the content below glide instead of jumping.
      const resize = before === after ? null
        : box.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: UNFOLD_MS, easing: EASE_OUT });
      await Promise.all([unfold.finished, resize?.finished]);
    } catch {
      // An interrupted animation (the page navigating away) leaves whichever face is mounted.
    } finally {
      turning.current = false;
    }
    settleFocus(next, previous);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && selected) {
      event.preventDefault();
      void flip(null);
    }
  };

  const back = selected ? breakdowns[selected] : undefined;
  return (
    // Above the next card while a taller face grows into place.
    <div ref={wrapper} onKeyDown={onKeyDown} className="relative z-10" style={{ perspective: "1200px" }}>
      <div ref={face}>
        {selected && back
          ? <BasketBack basket={selected} card={back} onBack={() => void flip(null)} />
          : <BarsCard card={baskets} hint={t("basketHelp")}
              onSelect={(row) => { if (isBasket(row.key) && breakdowns[row.key]) void flip(row.key); }} />}
      </div>
    </div>
  );
}

/** The back: one basket split into its categories - a segmented bar, then the list behind it. */
function BasketBack({ basket, card, onBack }: { basket: Basket; card: BarsCardData; onBack(): void }) {
  const { language, t } = useLanguage();
  const name = displayName(groupName(basket), language);
  const parts = card.rows.filter((row) => row.eur > 0); // largest first, as SQL sorted them
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest(KEEP)) return;
    onBack();
  };

  return (
    <section className="kori-card cursor-pointer" onClick={onClick} aria-labelledby={`basket-back-${basket}`}>
      <header className="mb-4 flex items-start gap-2">
        <button type="button" data-flip-back onClick={onBack} aria-label={t("backToBaskets")}
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-wash">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 id={`basket-back-${basket}`} className="text-lg font-bold leading-snug text-accent">{name}</h2>
          <p className="mt-1 text-xs leading-snug text-muted">{periodLabel(card.period.start, card.period.end, language)}</p>
        </div>
        <p className="money-col shrink-0 pt-1.5 text-lg font-semibold">{eur(card.total.eur, language)}</p>
      </header>

      {parts.length === 0 ? <p className="text-sm text-ink-2">{t("nothingInPeriod")}</p> : <>
        <SegmentedBar basket={basket} name={name} rows={inBarOrder(basket, parts)} />
        <ul className="mt-3 divide-y divide-line">
          {parts.map((row) => (
            <li key={row.key} className="flex items-center gap-3 py-2.5">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-[3px]" style={{ background: categoryColor(basket, row.key) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{displayName(row.key, language)}</span>
                <span className="block text-xs text-muted">
                  {row.n} {t(row.n === 1 ? "transaction" : "transactions")}{row.share_pct !== null && ` · ${row.share_pct}%`}
                </span>
              </span>
              <span className="money-col shrink-0 text-sm font-medium">{eur(row.eur, language)}</span>
            </li>
          ))}
        </ul>
      </>}

      <div data-no-flip><ShowTransactions ids={card.total.tx_ids} /></div>
      <p className="mt-3 text-center text-xs text-muted">{t("flipBack")}</p>
    </section>
  );
}

/** Tall segmented bar (dataviz spec): blocks in the basket's fixed color order, widths from the
 *  SQL shares, 2px surface gaps, 4px corners. Every block's share is visible: inside the block
 *  where it fits, otherwise just under it with a swatch of its color. Text never clips. */
function SegmentedBar({ basket, name, rows }: { basket: Basket; name: string; rows: SpendRow[] }) {
  const { language } = useLanguage();
  const bar = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = bar.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Labels wait for the bar's width, so nothing is placed before it can be placed right.
  const labels = width > 0 ? placeLabels(rows.map(({ key, share_pct }) => ({ key, share_pct })), width, labelWidth) : null;
  const describe = (row: SpendRow) => `${displayName(row.key, language)} ${eur(row.eur, language)}, ${row.share_pct}%`;

  return (
    <div>
      <div ref={bar} role="img" aria-label={`${name}: ${rows.map(describe).join("; ")}`} className="flex h-7 gap-0.5">
        {rows.map((row) => {
          const inside = labels?.inside.has(row.key) ?? false;
          return (
            <div key={row.key} title={describe(row)}
              className={`flex min-w-0 items-center rounded text-xs font-semibold ${inside ? "px-2" : ""}`}
              style={{ flex: `${row.share_pct ?? 0} 1 0px`, background: categoryColor(basket, row.key), color: categoryInk(basket, row.key) }}>
              {inside && <span className="whitespace-nowrap">{row.share_pct}%</span>}
            </div>
          );
        })}
      </div>
      {labels && labels.under.length > 0 && (
        <div aria-hidden="true" data-lane className="relative mt-1.5" style={{ height: labels.rows * LANE_ROW_PX - 2 }}>
          {labels.under.map((label) => (
            <span key={label.key} className="absolute flex items-center gap-1 whitespace-nowrap text-xs font-semibold leading-4 text-ink-2"
              style={{ left: label.left, top: label.row * LANE_ROW_PX }}>
              <span className="size-2 shrink-0 rounded-xs" style={{ background: categoryColor(basket, label.key) }} />
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

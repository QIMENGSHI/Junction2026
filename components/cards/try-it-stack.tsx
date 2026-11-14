"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { eur } from "@/lib/format";
import { displayName } from "@/lib/i18n";
import type { CutIdea, IdeasCard } from "@/lib/protocol";
import { useLanguage } from "../language-provider";
import { CutCard } from "./coach-cards";
import { CardFrame } from "./card-view";

/** A gesture that starts on a control belongs to that control (the slider must still drag). */
const CONTROLS = "input, button, summary, a, select, textarea, label";
const SWIPE_PX = 40;
/** An arrow floating over the stack (above every card), vertically centred: a 44px touch target
 *  around a 36px circle, so the circle keeps clear of the card's text. */
const ARROW = "group absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full";
const ARROW_FACE = "flex size-9 items-center justify-center rounded-full bg-surface/90 text-accent shadow-md "
  + "ring-1 ring-line backdrop-blur-sm transition-transform group-hover:bg-wash group-active:scale-95";

/** Where a card sits relative to the front one: front, peeking right (next), peeking left (previous). */
function placement(offset: number, count: number): CSSProperties {
  if (offset === 0) return { transform: "none", zIndex: 3 };
  // The peeks stay inside the page's 16px gutter plus the stack's 12px inset: no sideways scroll.
  if (offset === 1) return { transform: "translateX(20px) rotate(3deg) scale(.94)", zIndex: 2 };
  if (offset === count - 1) return { transform: "translateX(-20px) rotate(-3deg) scale(.94)", zIndex: 1 };
  return { transform: "scale(.9)", zIndex: 0, opacity: 0 };
}

/** The Try-it ideas as a stack of what-if cards. Swipe, or the arrows floating at the screen's
 *  edges, bring another card to the front; the card's own title names it. Every figure was
 *  computed by SQL; this only chooses which to show. */
export function TryItStack({ card }: { card: IdeasCard }) {
  const { language, t } = useLanguage();
  const [active, setActive] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const count = card.ideas.length;
  if (count === 0) return <CardFrame title={t("tryItIdeas")}><p className="text-sm text-ink-2" role="status">{t("noCutIdeas")}</p></CardFrame>;
  const front = Math.min(active, count - 1);
  const go = (to: number) => setActive((to + count) % count);
  const name = (idea: CutIdea) => displayName(idea.key, language);

  const why = (idea: CutIdea) => {
    const you = eur(idea.you_eur, language);
    const normal = idea.normal_eur === null ? "" : eur(idea.normal_eur, language);
    if (idea.reason === "peers") return t("whyPeers", { you, normal });
    if (idea.reason === "usual") return t("whyUsual", { you, normal });
    return t("whyLargest", { you });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest(CONTROLS)) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    // Touch pointers are captured implicitly; a mouse drag that ends outside the card must still count.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    if (!from || from.id !== event.pointerId) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(front + (dx < 0 ? 1 : -1));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as Element).closest("input, textarea, select")) return; // the slider owns its arrows
    if (event.key === "ArrowRight") { event.preventDefault(); go(front + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(front - 1); }
  };

  return (
    <section className="relative isolate min-w-0" aria-roledescription="carousel" aria-label={t("tryItIdeas")} onKeyDown={onKeyDown}>
      <p className="sr-only" role="status">{t("ideaOf", { n: front + 1, count, name: name(card.ideas[front]) })}</p>
      <div className="relative touch-pan-y px-3 py-2"
        onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null; }}>
        {card.ideas.map((idea, index) => {
          const offset = (index - front + count) % count;
          return (
            <div key={idea.key} style={placement(offset, count)}
              className={`${offset === 0 ? "relative" : "absolute inset-x-3 inset-y-2 overflow-hidden"} min-w-0 rounded-2xl bg-surface shadow-sm transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none`}
              role="group" aria-roledescription="slide" aria-label={t("ideaOf", { n: index + 1, count, name: name(idea) })}
              aria-hidden={offset !== 0} inert={offset !== 0}>
              <CutCard key={idea.key} card={idea.cut} why={why(idea)}
                badge={idea.excess_eur === null ? undefined : t("aboveNormal", { amount: eur(idea.excess_eur, language) })} />
            </div>
          );
        })}
      </div>
      {count > 1 && <>
        {/* On top of the cards, halfway down, at the screen's edges: the 14px offset puts them in
            the page's 16px gutter, clear of the card's text and inside the page (no sideways scroll). */}
        <button type="button" onClick={() => go(front - 1)} aria-label={t("previousIdea")}
          className={`${ARROW} -left-3.5`}>
          <span className={ARROW_FACE}><ChevronLeft aria-hidden="true" className="size-5" /></span>
        </button>
        <button type="button" onClick={() => go(front + 1)} aria-label={t("nextIdea")}
          className={`${ARROW} -right-3.5`}>
          <span className={ARROW_FACE}><ChevronRight aria-hidden="true" className="size-5" /></span>
        </button>
      </>}
    </section>
  );
}

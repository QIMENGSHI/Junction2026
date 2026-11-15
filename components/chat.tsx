"use client";

import { useEffect, useRef, useState } from "react";
import { CarTaxiFront, ChevronRight, ShoppingBasket, UserRound, UsersRound, UtensilsCrossed, Wallet } from "lucide-react";
import { AppHeader } from "./app-header";
import { AppNav } from "./app-nav";
import { AssistantMarkdown } from "./assistant-markdown";
import { CardView, PendingCard } from "./cards/card-view";
import { useLanguage } from "./language-provider";
import { type AssistantTurn, useKoriChat } from "./use-kori-chat";

const SUGGESTIONS = {
  en: [
    "How much did I spend on taxis last month?",
    "Where does my money really go?",
    "How much can I spend this week?",
    "What if I cut dining out by 20%?",
    "Is that normal for my age?",
    "What kind of spender am I?",
  ],
  fi: [
    "Paljonko käytin takseihin viime kuussa?",
    "Mihin rahani oikeasti menevät?",
    "Paljonko voin käyttää tällä viikolla?",
    "Entä jos vähentäisin ravintoloita 20 %?",
    "Onko se tavallista ikäiselleni?",
    "Millainen kuluttaja olen?",
  ],
};

const SHORT_LABELS = {
  en: ["Taxi spending", "My three baskets", "This week’s budget", "Spend less on dining", "Compare with my peers", "My spending habits"],
  fi: ["Taksimenot", "Kolme koriani", "Viikon käyttövara", "Säästä ravintoloista", "Vertaa ikäisiini", "Kulutustapani"],
};

const SHORTCUT_ICONS = [CarTaxiFront, ShoppingBasket, Wallet, UtensilsCrossed, UsersRound, UserRound];

export function Chat() {
  const { turns, busy, send, reset } = useKoriChat();
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const ask = (text: string) => {
    setDraft("");
    void send(text);
  };

  return (
    <div className="app-shell mx-auto flex h-dvh max-w-md flex-col bg-page">
      <AppHeader action={turns.length > 0 && (
          <button type="button" onClick={reset} disabled={busy}
            className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-wash disabled:opacity-40">
            {t("newChat")}
          </button>
        )} />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {turns.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center gap-6 pb-4">
            <div className="px-1">
              <p className="mb-2 text-sm font-medium text-accent">{t("coach")}</p>
              <h1 className="max-w-64 text-3xl font-bold leading-tight tracking-tight">{t("greeting")}</h1>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SUGGESTIONS[language].map((question, index) => {
                const Icon = SHORTCUT_ICONS[index];
                return (
                  <button key={question} type="button" onClick={() => ask(question)}
                    className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl bg-surface p-4 text-left text-sm font-semibold leading-snug hover:bg-wash">
                    <Icon size={24} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="flex w-full items-center justify-between gap-2">{SHORT_LABELS[language][index]}<ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden="true" /></span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {turns.map((turn, i) => (
              <li key={i}>
                {turn.role === "user" ? (
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2 text-on-accent">
                    {turn.text}
                  </p>
                ) : (
                  <Answer turn={turn} />
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={bottom} />
      </main>

      <form
        onSubmit={(event) => { event.preventDefault(); ask(draft); }}
        className="flex shrink-0 gap-2 bg-surface px-4 py-3">
        <label htmlFor="question" className="sr-only">{t("askPlaceholder")}</label>
        <input id="question" value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={t("askPlaceholder")} autoComplete="off" enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-line bg-wash px-4 py-3 text-base outline-none focus:border-accent" />
        <button type="submit" disabled={busy || !draft.trim()}
          className="rounded-full bg-accent px-5 font-medium text-on-accent disabled:opacity-40">
          {t("ask")}
        </button>
      </form>
      <AppNav />
    </div>
  );
}

function Answer({ turn }: { turn: AssistantTurn }) {
  const { t } = useLanguage();
  const nothingYet = turn.segments.length === 0 && turn.status === "streaming";
  return (
    <div className="flex flex-col gap-3">
      {nothingYet && <p className="text-sm text-muted" aria-live="polite">{t("looking")}</p>}
      {turn.segments.map((segment, i) =>
        segment.type === "text" ? (
          <AssistantMarkdown key={i} text={segment.text} />
        ) : segment.card ? (
          <CardView key={segment.id} card={segment.card} />
        ) : segment.error ? (
          <p key={segment.id} className="text-sm text-ink-2">
            <span className="font-medium text-critical">{t("calculationFailed")}</span> {t("tryAnother")}
          </p>
        ) : (
          <PendingCard key={segment.id} tool={segment.name} />
        ))}
      {turn.notice && <p className="text-sm text-ink-2">{turn.notice}</p>}
      {turn.status === "error" && (
        <p role="alert" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <span className="font-medium text-critical">{t("wentWrong")}</span> {turn.error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./app-header";
import { AppNav } from "./app-nav";
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
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-page">
      <AppHeader action={turns.length > 0 && (
          <button type="button" onClick={reset} disabled={busy}
            className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-wash disabled:opacity-40">
            {t("newChat")}
          </button>
        )} />

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-4 pb-2">
            <div>
              <p className="text-2xl font-semibold leading-snug">{t("greeting")}</p>
              <p className="mt-2 text-sm text-ink-2">
                {t("intro")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[language].map((question) => (
                <button key={question} type="button" onClick={() => ask(question)}
                  className="rounded-full border border-line bg-surface px-3 py-2 text-left text-sm hover:bg-wash">
                  {question}
                </button>
              ))}
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
        className="flex gap-2 border-t border-line bg-page px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <label htmlFor="question" className="sr-only">{t("askPlaceholder")}</label>
        <input id="question" value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={t("askPlaceholder")} autoComplete="off" enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent" />
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
          <p key={i} className="whitespace-pre-wrap leading-relaxed">{segment.text}</p>
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

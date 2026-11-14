"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseState } from "@/lib/purchase-presets";
import type { BarsCard as BarsCardData, IdeasCard, SafeCard as SafeCardData } from "@/lib/protocol";
import { AppHeader } from "./app-header";
import { AppNav } from "./app-nav";
import { BarsCard, SafeCard } from "./cards/money-cards";
import { TryItStack } from "./cards/try-it-stack";
import { useLanguage } from "./language-provider";
import { SimulateSheet } from "./simulate-sheet";

export function Home({ safe, baskets, ideas, simulation }: { safe: SafeCardData; baskets: BarsCardData; ideas: IdeasCard; simulation: PurchaseState }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const version = useRef(simulation.version);
  const updated = (state: PurchaseState) => {
    // The rendered server props own the version, so a failed refresh is retried next poll.
    void state;
    startTransition(() => router.refresh());
  };
  useEffect(() => {
    version.current = simulation.version;
  }, [simulation.version]);
  useEffect(() => {
    if (!simulation.enabled) return;
    let stopped = false, checking = false;
    const controller = new AbortController();
    const poll = async () => {
      if (document.visibilityState !== "visible" || checking) return;
      checking = true;
      try {
        const response = await fetch("/api/purchases", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("poll failed");
        const next = await response.json() as PurchaseState;
        if (stopped) return;
        setFailed(false);
        if (version.current !== next.version) {
          startTransition(() => router.refresh());
        }
      } catch { if (!stopped) setFailed(true); }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => void poll(), 5000);
    document.addEventListener("visibilitychange", poll);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [simulation.enabled, router]);
  return (
    <div className="app-shell mx-auto flex h-dvh max-w-md flex-col bg-page">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <section className="mb-4 flex items-baseline justify-between gap-3 px-1">
          <h1 className="text-xl font-bold text-accent">{t("overview")}</h1>
          <p className="text-xs text-muted">{t("today")}</p>
        </section>

        <div className="flex flex-col gap-4">
          <SafeCard card={safe} />

          {simulation.enabled && <div className="px-1">
            <button type="button" onClick={() => setSheet(true)} className="min-h-11 text-sm font-semibold text-accent">+ {t("simulatePurchase")}</button>
            {simulation.purchases.length > 0 && <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-1 text-xs">
              <span>{t(simulation.purchases.length === 1 ? "simulatedSingle" : "simulatedCount", { count: simulation.purchases.length })}</span>
              <button type="button" disabled={resetting} className="min-h-11 font-semibold text-accent disabled:opacity-50" onClick={async () => {
                setResetting(true); setFailed(false);
                try {
                  const response = await fetch("/api/purchases", { method: "DELETE" });
                  if (!response.ok) throw new Error("reset failed");
                  updated(await response.json());
                } catch { setFailed(true); }
                finally { setResetting(false); }
              }}>{t(resetting ? "updating" : "resetDemo")}</button>
            </div>}
            {failed && <p role="status" className="text-xs text-critical">{t("liveUnavailable")}</p>}
          </div>}

          <BarsCard card={baskets} />
          {/* A new ranking (e.g. after a simulated purchase) starts again from its first idea. */}
          <TryItStack key={ideas.ideas.map((idea) => idea.key).join("|")} card={ideas} />

          <Link href="/chat" className="mb-2 flex min-h-14 items-center justify-between rounded-2xl bg-accent px-5 py-3 font-semibold text-on-accent">
            <span>{t("askKori")}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <AppNav />
      <SimulateSheet open={sheet} onClose={() => setSheet(false)} onUpdated={updated} />
    </div>
  );
}

"use client";

import Link from "next/link";
import type { BarsCard as BarsCardData, CutCard as CutCardData, SafeCard as SafeCardData } from "@/lib/protocol";
import { AppHeader } from "./app-header";
import { AppNav } from "./app-nav";
import { CutCard } from "./cards/coach-cards";
import { BarsCard, SafeCard } from "./cards/money-cards";
import { useLanguage } from "./language-provider";

export function Home({ safe, baskets, cut }: { safe: SafeCardData; baskets: BarsCardData; cut: CutCardData }) {
  const { t } = useLanguage();
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

          <BarsCard card={baskets} />
          <CutCard card={cut} />

          <Link href="/chat" className="mb-2 flex min-h-14 items-center justify-between rounded-2xl bg-accent px-5 py-3 font-semibold text-on-accent">
            <span>{t("askKori")}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <AppNav />
    </div>
  );
}

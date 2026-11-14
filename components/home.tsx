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
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-page">
      <AppHeader />
      <main className="flex-1 overflow-y-auto px-4 py-5">
        <section className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{t("today")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("overview")}</h1>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-2">{t("homeIntro")}</p>
        </section>

        <div className="flex flex-col gap-6">
          <SafeCard card={safe} />

          <section>
            <div className="mb-2 px-1">
              <h2 className="text-lg font-semibold">{t("basketTitle")}</h2>
              <p className="text-sm text-ink-2">{t("basketHelp")}</p>
            </div>
            <BarsCard card={baskets} />
          </section>

          <section>
            <div className="mb-2 px-1">
              <h2 className="text-lg font-semibold">{t("planTitle")}</h2>
            </div>
            <CutCard card={cut} />
          </section>

          <Link href="/chat" className="mb-2 flex items-center justify-between rounded-2xl bg-accent px-4 py-3 font-medium text-on-accent">
            <span>{t("askKori")}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <AppNav />
    </div>
  );
}

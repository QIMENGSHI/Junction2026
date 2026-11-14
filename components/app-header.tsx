"use client";

import { LanguageToggle } from "./language-provider";

export function AppHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="flex min-h-18 shrink-0 items-center justify-between gap-3 bg-surface px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2.5 text-accent">
        <svg width="29" height="29" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m8 11 6-7 6 7M4 11h20l-3 13H7L4 11Z" /><path d="M11 15v5m6-5v5" />
        </svg>
        <p className="text-[23px] font-bold tracking-tight">Kori</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action}
        <LanguageToggle />
      </div>
    </header>
  );
}

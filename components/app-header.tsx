"use client";

import { LanguageToggle, useLanguage } from "./language-provider";

export function AppHeader({ action }: { action?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight">Kori</p>
        <p className="truncate text-xs text-muted">{t("tagline")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action}
        <LanguageToggle />
      </div>
    </header>
  );
}

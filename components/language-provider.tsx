"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { copy, type CopyKey, type Language } from "@/lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage(language: Language): void;
  t(key: CopyKey, values?: Record<string, string | number>): string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("kori-language");
    if (stored === "fi" || stored === "en") setLanguage(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("kori-language", language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => copy(language, key, values),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <button type="button" onClick={() => setLanguage(language === "en" ? "fi" : "en")}
      className="min-h-11 rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-wash"
      aria-label={language === "en" ? "Vaihda kieleksi suomi" : "Switch language to English"}>
      {t("language")}
    </button>
  );
}

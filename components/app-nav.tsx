"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./language-provider";

const items = [
  { href: "/", key: "home" as const, icon: HomeIcon },
  { href: "/chat", key: "coach" as const, icon: ChatIcon },
];

export function AppNav() {
  const pathname = usePathname();
  const { language, t } = useLanguage();
  return (
    <nav aria-label={language === "fi" ? "Päänavigaatio" : "Primary"} className="shrink-0 border-t border-line bg-surface pb-[max(0.4rem,env(safe-area-inset-bottom))]">
      <ul className="mx-auto grid max-w-md grid-cols-2">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "text-accent" : "text-muted hover:text-ink-2"}`}>
                <Icon filled={active} />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

function ChatIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A7 7 0 0 1 3 13V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" />
      {!filled && <path d="M8 10h8M8 14h5" />}
    </svg>
  );
}

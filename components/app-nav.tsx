"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle } from "lucide-react";
import { useLanguage } from "./language-provider";

const items = [
  { href: "/", key: "home" as const, icon: House },
  { href: "/chat", key: "coach" as const, icon: MessageCircle },
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
                <Icon size={22} strokeWidth={active ? 2.25 : 1.8} aria-hidden="true" />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

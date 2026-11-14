"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "./language-provider";

export function BottomSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose(): void;
  title: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const { t } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();

    const background = [...document.body.children]
      .filter((element) => element !== overlay.current)
      .map((element) => {
        const html = element as HTMLElement & { inert: boolean };
        const state = { html, inert: html.inert, ariaHidden: html.getAttribute("aria-hidden") };
        html.inert = true;
        html.setAttribute("aria-hidden", "true");
        return state;
      });

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHandler.current();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", keydown);
      for (const { html, inert, ariaHidden } of background) {
        html.inert = inert;
        if (ariaHidden === null) html.removeAttribute("aria-hidden");
        else html.setAttribute("aria-hidden", ariaHidden);
      }
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div ref={overlay} className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button type="button" tabIndex={-1} aria-label={t("close")} onClick={() => closeHandler.current()} className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id}
        className="relative z-10 max-h-[86dvh] w-full max-w-md overflow-hidden rounded-t-3xl border border-line bg-page shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-2">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          <button ref={close} type="button" onClick={() => closeHandler.current()}
            className="grid h-9 w-9 place-items-center rounded-full bg-wash text-xl text-ink-2 hover:bg-line"
            aria-label={t("close")}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="max-h-[calc(86dvh-4.5rem)] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}

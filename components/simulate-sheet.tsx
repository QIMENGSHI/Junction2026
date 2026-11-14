"use client";

import { useState } from "react";
import { PURCHASE_PRESETS, type PurchasePreset, type PurchaseState } from "@/lib/purchase-presets";
import { BottomSheet } from "./bottom-sheet";
import { useLanguage } from "./language-provider";

export function SimulateSheet({ open, onClose, onUpdated }: {
  open: boolean; onClose(): void; onUpdated(state: PurchaseState): void;
}) {
  const { t } = useLanguage();
  const [preset, setPreset] = useState<PurchasePreset>("dinner");
  const [amount, setAmount] = useState("150");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <BottomSheet open={open} onClose={onClose} title={t("simulatePurchase")}>
    <form className="space-y-5 py-3" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError(false);
      try {
        const response = await fetch("/api/purchases", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ preset, amount_eur: Number(amount.replace(",", ".")) }) });
        if (!response.ok) throw new Error("purchase failed");
        onUpdated(await response.json()); onClose();
      } catch { setError(true); }
      finally { setBusy(false); }
    }}>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(PURCHASE_PRESETS) as PurchasePreset[]).map((key) => <button key={key} type="button"
          disabled={busy} aria-pressed={preset === key} onClick={() => { setPreset(key); setAmount(String(PURCHASE_PRESETS[key].amount)); setError(false); }}
          className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${preset === key ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-accent"}`}>
          {t(key)}
        </button>)}
      </div>
      <label className="block text-sm font-semibold">{t("purchaseAmount")}
        <input type="number" inputMode="decimal" min="1" max="5000" step="0.01" required value={amount} disabled={busy}
          onChange={(event) => setAmount(event.target.value)} className="mt-2 block min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-2xl text-accent" />
      </label>
      <p className="text-xs text-muted">{t("simulationHelp")}</p>
      {error && <p role="alert" className="text-sm text-critical">{t("purchaseFailed")}</p>}
      <button disabled={busy} className="min-h-12 w-full rounded-full bg-accent px-4 font-semibold text-on-accent disabled:opacity-50">
        {t(busy ? "updating" : "addPurchase")}
      </button>
    </form>
  </BottomSheet>;
}

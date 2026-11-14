// Safe for browser imports. No database driver or credentials in this module.
export const PURCHASE_PRESETS = {
  dinner: { category: "Restaurants", mcc: 5812, amount: 150 },
  taxi: { category: "Transportation", mcc: 4121, amount: 45 },
  groceries: { category: "Groceries", mcc: 5411, amount: 80 },
  dentist: { category: "Health", mcc: 8021, amount: 480 },
} as const;
export type PurchasePreset = keyof typeof PURCHASE_PRESETS;
export type PurchaseSummary = { tx_id: number; label: string; amount_eur: number; date: string };
export type PurchaseState = { enabled: boolean; purchases: PurchaseSummary[]; version: string };

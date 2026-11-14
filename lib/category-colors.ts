// Colors for one basket's categories on the back of the Home baskets card. Safe for browser imports.
//
// Color follows the category, never its rank: each basket has a fixed order, the segmented bar
// draws its blocks in that order, and slot N is always the same hue (--cat-N in globals.css).
// The order covers every category the basket rules in build_db.py can put in that basket;
// scripts/try_tools.ts checks it against every row.
//
// Validated with the dataviz skill's validate_palette.js (light mode, white card surface, Nov 2026):
// - consecutive slots pass every gate: worst CVD ΔE 9.1, worst normal-vision ΔE 19.6;
// - blocks that touch because a category between them is €0 still clear the normal-vision floor,
//   except blue (1) beside violet (6), which needs everyday slots 2-5 all at €0 in one month;
// - CVD 6-8 warn-band pairs (worst 6.1) are legal with the 2px gaps and the labelled list;
// - aqua, yellow and magenta sit under 3:1 on white: the list prints every name and amount.

export type Basket = "regular" | "everyday" | "irregular";

/** Display order of the three baskets. */
export const BASKETS: readonly Basket[] = ["regular", "everyday", "irregular"];

export const CATEGORY_ORDER: Record<Basket, readonly string[]> = {
  regular: ["Housing", "Groceries", "Transportation", "Utilities"],
  everyday: ["Restaurants", "Entertainment", "Lifestyle", "Transportation", "Travel", "Home & Tech"],
  irregular: ["Health", "Home & Tech"],
};

export const isBasket = (key: string): key is Basket => (BASKETS as readonly string[]).includes(key);

/** 1-based color slot of a category in its basket, or null if the basket rules never put it there. */
export function categorySlot(basket: Basket, category: string): number | null {
  const index = CATEGORY_ORDER[basket].indexOf(category);
  return index < 0 ? null : index + 1;
}

export function categoryColor(basket: Basket, category: string): string {
  const slot = categorySlot(basket, category);
  return slot === null ? "var(--muted)" : `var(--cat-${slot})`;
}

/** Text printed inside a block: white, except near-black on yellow (slot 3), per the palette. */
export function categoryInk(basket: Basket, category: string): string {
  return categorySlot(basket, category) === 3 ? "#0b0b0b" : "#ffffff";
}

/** Rows in the bar's draw order: the basket's fixed order, any unknown category last. */
export function inBarOrder<T extends { key: string }>(basket: Basket, rows: readonly T[]): T[] {
  const rank = (row: T) => categorySlot(basket, row.key) ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

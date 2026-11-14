// Segmented-bar label placement (lib/segment-labels.ts): every share is shown, inside its block
// when it fits, otherwise under the bar - never clipped, never overlapping, never past the bar.
//   node --import tsx scripts/try_layout.ts
import { placeLabels, SEGMENT_PX } from "../lib/segment-labels";

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)})`}`);
}
const measure = (text: string) => text.length * 7; // close to 12px semibold digits

function sound(segments: { key: string; share_pct: number }[], width: number) {
  const layout = placeLabels(segments, width, measure);
  const shown = new Set([...layout.inside, ...layout.under.map((u) => u.key)]);
  // Labels sharing a lane row never overlap; every label stays inside the bar's width.
  const apart = layout.under.every((a) => layout.under.every((b) => a === b || a.row !== b.row
    || a.left + a.width + SEGMENT_PX.laneGap <= b.left + 1e-9 || b.left + b.width + SEGMENT_PX.laneGap <= a.left + 1e-9));
  const within = layout.under.every((u) => u.left >= 0 && u.left + u.width <= width + 1e-9);
  return { layout, ok: shown.size === segments.length && apart && within };
}

// The demo: Everyday spending, September 2026, in bar order, on a 318px bar (390px phone).
const everyday = [
  { key: "Restaurants", share_pct: 11.1 }, { key: "Entertainment", share_pct: 29.3 },
  { key: "Lifestyle", share_pct: 29.3 }, { key: "Transportation", share_pct: 30.3 },
];
const demo = sound(everyday, 318);
check("demo: three shares inside, Restaurants' 11.1% under its own block at the bar's start, one lane row",
  demo.ok && [...demo.layout.inside].join() === "Entertainment,Lifestyle,Transportation" && demo.layout.rows === 1
    && demo.layout.under.length === 1 && demo.layout.under[0].key === "Restaurants" && demo.layout.under[0].left === 0, demo.layout);

const crowded = [
  { key: "a", share_pct: 3 }, { key: "b", share_pct: 2 }, { key: "c", share_pct: 4 }, { key: "d", share_pct: 85 },
  { key: "e", share_pct: 4 }, { key: "f", share_pct: 2 },
];
const busy = sound(crowded, 318);
check("several narrow blocks: every share shown, lane labels apart and inside the bar", busy.ok, busy.layout.under);
check("a narrow last block's label is pulled back inside the bar",
  busy.layout.under.at(-1)!.left + busy.layout.under.at(-1)!.width <= 318, busy.layout.under.at(-1));

const tiny = sound([{ key: "x", share_pct: 50 }, { key: "y", share_pct: 50 }], 60);
check("labels too wide for one lane row wrap to a second row instead of overlapping",
  tiny.ok && tiny.layout.under.length === 2 && tiny.layout.rows === 2, tiny.layout);

const whole = sound([{ key: "Home & Tech", share_pct: 100 }], 318);
check("one block of 100% prints inside", whole.ok && whole.layout.inside.has("Home & Tech") && whole.layout.under.length === 0, whole.layout);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall segmented-bar layout checks passed");
process.exit(failed ? 1 : 0);

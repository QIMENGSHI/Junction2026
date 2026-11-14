// Where each share label of a segmented bar goes. Pure layout in pixels: no money arithmetic,
// the shares themselves come from SQL. Safe for browser imports; tested by scripts/try_layout.ts.

export type Segment = { key: string; share_pct: number | null };

/** Must match the bar's classes: gap-0.5, px-2, a size-2 swatch with gap-1, and the lane spacing. */
export const SEGMENT_PX = { gap: 2, pad: 8, swatch: 8, swatchGap: 4, laneGap: 8 } as const;

export type LabelLayout = {
  /** Keys whose share fits inside their own block, with padding on both sides. */
  inside: Set<string>;
  /** The rest, in a lane under the bar: left edge in px from the bar's left edge, and the lane
   *  row (0 = first line). A label wraps to a new row rather than overlap or leave the bar. */
  under: { key: string; text: string; left: number; width: number; row: number }[];
  rows: number;
};

/** Inside the block when the measured text fits with padding; otherwise under the bar, as close
 *  to the start of its own block as the lane allows: on the first row where it fits without
 *  overlapping a neighbor or passing the bar's end, else on a new row. */
export function placeLabels(segments: readonly Segment[], width: number, measure: (text: string) => number): LabelLayout {
  const room = width - Math.max(0, segments.length - 1) * SEGMENT_PX.gap;
  let x = 0;
  const inside = new Set<string>();
  const under: LabelLayout["under"] = [];
  const rowEnds: number[] = []; // right edge of the last label on each lane row
  for (const segment of segments) {
    const span = (room * (segment.share_pct ?? 0)) / 100;
    const text = `${segment.share_pct}%`;
    const textWidth = measure(text);
    if (span >= textWidth + 2 * SEGMENT_PX.pad) {
      inside.add(segment.key);
    } else {
      const labelWidth = SEGMENT_PX.swatch + SEGMENT_PX.swatchGap + textWidth;
      for (let row = 0; ; row++) {
        const end = rowEnds[row];
        const earliest = end === undefined ? 0 : end + SEGMENT_PX.laneGap;
        const left = Math.max(0, Math.min(Math.max(x, earliest), width - labelWidth));
        if (end === undefined || left >= earliest) {
          under.push({ key: segment.key, text, left, width: labelWidth, row });
          rowEnds[row] = left + labelWidth;
          break;
        }
      }
    }
    x += span + SEGMENT_PX.gap;
  }
  return { inside, under, rows: rowEnds.length };
}

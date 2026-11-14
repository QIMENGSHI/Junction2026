/** Kori's fixed settings. The demo is hard-wired to one customer, chosen server-side, so the
 *  model can never ask about anyone else. */
export const CUSTOMER = process.env.KORI_CUSTOMER ?? "CUST04414";

export const MODEL = "claude-opus-5-5";

/** Claude Opus 5.5 always thinks; effort sets how much. "low" keeps answers fast on stage.
 *  Raise to "medium" if it starts choosing the wrong tool or period. */
export const EFFORT = (process.env.KORI_EFFORT ?? "low") as "low" | "medium" | "high" | "xhigh" | "max";

/** Upper bound on model -> tools -> model rounds in one answer. */
export const MAX_TOOL_ROUNDS = 6;

/** Stage-safe model policy: on always uses the prepared router; auto uses it without a key and
 *  can fall back after a live-model failure; off always requires Claude. */
const requestedDemoMode = process.env.KORI_DEMO_MODE ?? "auto";
export const DEMO_MODE: "on" | "auto" | "off" =
  requestedDemoMode === "on" || requestedDemoMode === "off" ? requestedDemoMode : "auto";
export const USE_DEMO_AGENT = DEMO_MODE === "on" || (DEMO_MODE === "auto" && !process.env.ANTHROPIC_API_KEY);

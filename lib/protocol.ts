// What the server sends the browser. Cards carry full data, ids included, for the screen;
// the model only ever gets the compact summaries built in lib/tools.ts.

export type Flow = "spending" | "income" | "saving";

export type Period = { start: string; end: string; months: number };

export type SpendRow = {
  key: string;
  eur: number;
  n: number;
  per_month_eur: number;
  share_pct: number | null;
  tx_ids: number[];
};

export type NumberCard = {
  kind: "number";
  title: string;
  flow: Flow;
  period: Period;
  eur: number;
  n: number;
  per_month_eur: number;
  tx_ids: number[];
};

export type BarsCard = {
  kind: "bars";
  title: string;
  group_by: string;
  /** The basket the result is filtered to, if any: its bars take that basket's color. */
  basket: string | null;
  flow: Flow;
  period: Period;
  rows: SpendRow[];
  total: SpendRow;
  /** Difference between the rounded monthly total and its separately rounded groups. */
  monthly_rounding_eur?: number;
};

export type SafeLine = {
  key: string;
  kind: "start" | "minus" | "result" | "info";
  label: string;
  eur: number;
  note: string;
  tx_ids: number[];
};

export type SafeCard = {
  kind: "safe_to_spend";
  today: string;
  payday: string;
  days_to_payday: number;
  lines: SafeLine[];
};

export type TxRow = {
  tx_id: number;
  date: string;
  time: string;
  weekday: string;
  label: string;
  category: string;
  basket: string | null;
  flow: string;
  amount_eur: number;
  balance_after_eur: number;
  merchant_id: string | null;
  mcc_code: number | null;
};

export type TransactionsCard = { kind: "transactions"; title: string; rows: TxRow[] };

export type CutCard = {
  kind: "cut";
  title: string;
  cut_pct: number;
  monthly_now: number;
  monthly_after: number;
  monthly_saving: number;
  yearly_saving: number;
  weekly_now: number;
  weekly_after: number;
  weekly_saving: number;
  safe_to_spend_week: number;
  purchases: number;
  simulated_purchases?: number;
  period_start: string;
  period_end: string;
  pct_steps: number[];
  monthly_saving_steps: number[];
  yearly_saving_steps: number[];
  weekly_after_steps: number[];
  tx_ids: number[];
};

export type BenchmarkRow = {
  category: string;
  age_band: string;
  you_per_month: number;
  your_purchases: number;
  peers_avg_per_month: number;
  peers_median_per_month: number;
  peers_counted: number;
  peers_in_band: number;
  times_peer_avg: number | null;
  percentile: number | null;
  tx_ids: number[];
};

export type BenchmarkCard = { kind: "benchmark"; rows: BenchmarkRow[] };

export type ProfileRow = {
  line: number;
  kind: "persona" | "evidence" | "habit";
  key: string;
  title: string;
  text: string;
  value: number;
  tx_ids: number[];
};

export type ProfileCard = { kind: "profile"; rows: ProfileRow[] };

export type Card = NumberCard | BarsCard | SafeCard | TransactionsCard | CutCard | BenchmarkCard | ProfileCard;

/** One line of the /api/chat response stream (newline-delimited JSON). */
export type ChatProgressEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string }
  | { type: "card"; id: string; card: Card }
  | { type: "tool_error"; id: string; message: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };

/** Internal agent event. The API replaces history with a signed token before it crosses to the browser. */
export type ChatEvent = ChatProgressEvent | { type: "done"; history: unknown[] };

/** One line actually sent over /api/chat. The browser cannot read or alter model history. */
export type ClientChatEvent = ChatProgressEvent | { type: "done"; history_token: string };

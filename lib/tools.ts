// The six tools the model can call. Each one runs a fixed SQL tool from kori/sql/tools.sql
// and returns two things:
//   card  - the full result, ids included, rendered on screen (never sent to the model)
//   model - a compact summary for the model: figures and labels, no ids, no transaction rows
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CUSTOMER } from "./config";
import { query, type SqlParam } from "./db";
import { capitalize } from "./format";
import type {
  BarsCard, BenchmarkCard, BenchmarkRow, Card, CutCard, CutIdea, Flow, IdeasCard, NumberCard, Period, ProfileCard, ProfileRow,
  SafeCard, SafeLine, SpendRow, TransactionsCard, TxRow,
} from "./protocol";

const PERIODS = ["this_week", "last_week", "last_30_days", "this_month", "last_month", "last_3_months",
  "last_6_months", "last_12_months", "this_year", "all", "custom"] as const;
const GROUPINGS = ["total", "category", "label", "basket", "month", "weekday", "merchant"] as const;
const BASKETS = ["regular", "irregular", "everyday"] as const;
const FLOWS = ["spending", "income", "saving"] as const;
const SORTS = ["newest", "oldest", "largest"] as const;

type ToolResult = { model: unknown; card: Card };
type ToolSpec = {
  name: string;
  description: string;
  schema: z.ZodObject;
  run(input: unknown): Promise<ToolResult>;
};

function tool<S extends z.ZodObject>(spec: {
  name: string;
  description: string;
  schema: S;
  run(input: z.output<S>): Promise<ToolResult>;
}): ToolSpec {
  return spec as unknown as ToolSpec;
}

/** Calls one SQL tool (a table macro) for the demo customer. Only arguments that are set are
 *  passed, so every default lives in one place, the SQL. Macro and argument names come from
 *  this file; values are always bound, never pasted into the SQL text. Projection is fixed
 *  application SQL, never tool input. */
async function callTool<T>(macro: string, args: Record<string, SqlParam | undefined>, projection = "*"): Promise<T[]> {
  const set = Object.entries(args).filter((entry): entry is [string, SqlParam] => entry[1] !== undefined);
  const sql = `select ${projection} from ${macro}($customer${set.map(([name]) => `, ${name} := $${name}`).join("")})`;
  return query<T>(sql, { customer: CUSTOMER, ...Object.fromEntries(set) });
}

/** What a filter names, for card titles: "Taxi", "Everyday basket", "Spending". */
function subjectOf(input: { label?: string; category?: string; basket?: string; flow?: Flow }): string {
  if (input.label) return input.label;
  if (input.category) return input.category;
  if (input.basket) return `${capitalize(input.basket)} basket`;
  if (input.flow === "income") return "Money in";
  if (input.flow === "saving") return "Saving";
  return "Spending";
}

// ------------------------------------------------------------------ the tools

type SpendSqlRow = SpendRow & { is_total: boolean; period_start: string; period_end: string; period_months: number; monthly_rounding_eur: number };

const GROUP_NAMES: Record<(typeof GROUPINGS)[number], string> = {
  total: "total", category: "category", label: "type", basket: "basket", month: "month", weekday: "weekday",
  merchant: "merchant",
};

async function spendBy(input: {
  group_by: (typeof GROUPINGS)[number]; period: (typeof PERIODS)[number]; from_date?: string; to_date?: string;
  flow?: Flow; category?: string; label?: string; basket?: string;
}): Promise<ToolResult> {
  // Preserve each correctly rounded average and expose any cent difference explicitly.
  // The browser never adds or alters monetary values to make the chart reconcile.
  const rows = await callTool<SpendSqlRow>("spend_by", {
    group_by: input.group_by, period: input.period, from_date: input.from_date, to_date: input.to_date,
    only_flow: input.flow, only_category: input.category, only_label: input.label, only_basket: input.basket,
  }, `*, case when is_total then coalesce(per_month_eur -
    sum(per_month_eur) filter (where not is_total) over (), 0)
    else 0 end::decimal(12,2) as monthly_rounding_eur`);
  const total = rows.find((row) => row.is_total);
  if (!total) throw new Error("spend_by returned no total row");
  const period: Period = { start: total.period_start, end: total.period_end, months: total.period_months };
  const flow = input.flow ?? "spending";
  const pick = ({ key, eur, n, per_month_eur, share_pct, tx_ids }: SpendSqlRow): SpendRow =>
    ({ key, eur, n, per_month_eur, share_pct, tx_ids });
  const groups = rows.filter((row) => !row.is_total).map(pick);
  const subject = subjectOf(input);

  const card: NumberCard | BarsCard = input.group_by === "total"
    ? { kind: "number", title: subject, flow, period, eur: total.eur, n: total.n, per_month_eur: total.per_month_eur, tx_ids: total.tx_ids }
    : {
        kind: "bars", title: `${subject} by ${GROUP_NAMES[input.group_by]}`, group_by: input.group_by,
        basket: input.basket ?? null, flow, period, rows: groups, total: pick(total),
        monthly_rounding_eur: total.monthly_rounding_eur,
      };

  const monthly = period.months > 1; // per-month averages only mean something over several months
  const model = {
    shown_as: card.kind === "number" ? "number card" : "bar chart",
    period,
    flow,
    total: { eur: total.eur, transactions: total.n, ...(monthly ? { per_month_eur: total.per_month_eur,
      monthly_rounding_eur: total.monthly_rounding_eur } : {}) },
    ...(groups.length ? {
      groups: groups.map(({ key, eur, n, per_month_eur, share_pct }) =>
        ({ key, eur, transactions: n, ...(monthly ? { per_month_eur } : {}), share_pct })),
    } : {}),
  };
  return { model, card };
}

type SafeSqlRow = SafeLine & { line: number; today: string; payday: string; days_to_payday: number };

async function safeToSpend(input: { savings_goal?: number }): Promise<ToolResult> {
  const rows = await callTool<SafeSqlRow>("safe_to_spend", { savings_goal: input.savings_goal });
  const lines: SafeLine[] = rows.map(({ key, kind, label, eur, note, tx_ids }) => ({ key, kind, label, eur, note, tx_ids }));
  const { today, payday, days_to_payday } = rows[0];
  const card: SafeCard = { kind: "safe_to_spend", today, payday, days_to_payday, lines };
  const model = {
    shown_as: "safe-to-spend card, with each line of the calculation",
    today, payday, days_to_payday,
    lines: lines.map(({ key, label, eur, note }) => ({ key, label, eur, note })),
  };
  return { model, card };
}

async function simulateCut(input: {
  category?: string; label?: string; basket?: string; pct: number; period?: (typeof PERIODS)[number];
}): Promise<ToolResult> {
  if (!input.category && !input.label && !input.basket) {
    throw new Error("Name what to cut: a category, a label or a basket.");
  }
  const [row] = await callTool<Omit<CutCard, "kind" | "title">>("simulate_cut", {
    only_category: input.category, only_label: input.label, only_basket: input.basket,
    pct: input.pct, period: input.period,
  }, `*, (select count(*)::integer from transactions t
    where t.customer_id = $customer and t.merchant_id = 'SIMULATED'
      and list_contains(tx_ids, t.tx_id)) as simulated_purchases`);
  const card: CutCard = { kind: "cut", title: subjectOf(input), ...row };
  const model = {
    shown_as: "what-if slider card (0-100%)",
    cutting: card.title,
    cut_pct: row.cut_pct,
    monthly_now: row.monthly_now, monthly_after: row.monthly_after,
    monthly_saving: row.monthly_saving, yearly_saving: row.yearly_saving,
    weekly_now: row.weekly_now, weekly_after: row.weekly_after, weekly_saving: row.weekly_saving,
    safe_to_spend_week: row.safe_to_spend_week,
    averaged_over: { start: row.period_start, end: row.period_end, purchases: row.purchases,
      simulated_purchases: row.simulated_purchases },
  };
  return { model, card };
}

/** How many ideas the Try-it stack holds. */
const IDEAS = 3;

const REASONS: Record<CutIdea["reason"], string> = {
  peers: "per month over all data, above the average of people in the same age band who spend on it",
  usual: "this month so far, above the customer's own usual month (the 12 months before this one)",
  largest: "one of the largest everyday spending groups; no above-normal comparison is used",
};

async function suggestCuts(input: { exclude?: string[] }): Promise<ToolResult> {
  const exclude = new Set(input.exclude ?? []);
  // One statement gives the ranking, explanations and slider values the same database
  // snapshot, even if a purchase is committed while Home is refreshing.
  const rows = await query<Omit<CutIdea, "cut"> & Omit<CutCard, "kind" | "title">>(`
    with picked as (
      select * from suggest_cuts($customer, max_rows := $max_rows)
      where not list_contains($excluded::json::varchar[], key)
      order by rank limit 3
    )
    select i.* exclude (tx_ids), c.*,
      (select count(*)::integer from transactions t
       where t.customer_id = $customer and t.merchant_id = 'SIMULATED'
         and list_contains(c.tx_ids, t.tx_id)) as simulated_purchases
    from picked i, lateral simulate_cut($customer,
      only_category := case when i.kind = 'category' then i.key end,
      only_label := case when i.kind = 'label' then i.key end,
      only_basket := 'everyday', pct := 20, period := i.period) c
    order by i.rank`, {
    customer: CUSTOMER, max_rows: IDEAS + exclude.size, excluded: JSON.stringify([...exclude]),
  });
  const ideas: CutIdea[] = rows.map(({ rank, kind, key, reason, period, you_eur, normal_eur, excess_eur, n, ...cut }) => ({
    rank, kind, key, reason, period, you_eur, normal_eur, excess_eur, n,
    cut: { kind: "cut", title: key, ...cut },
  }));
  const card: IdeasCard = { kind: "ideas", ideas };
  const model = {
    shown_as: "swipeable stack of Try-it cards, one per idea, each a 0-100% what-if slider starting at 20%",
    ideas: ideas.map((idea) => ({
      rank: idea.rank,
      cutting: idea.key,
      why: REASONS[idea.reason],
      you_eur: idea.you_eur,
      normal_eur: idea.normal_eur,
      above_normal_eur: idea.excess_eur,
      monthly_saving_at_20pct: idea.cut.monthly_saving,
      yearly_saving_at_20pct: idea.cut.yearly_saving,
      averaged_over: { start: idea.cut.period_start, end: idea.cut.period_end },
    })),
  };
  return { model, card };
}

async function benchmark(input: { category?: string }): Promise<ToolResult> {
  const rows = await callTool<BenchmarkRow>("benchmark", { only_category: input.category });
  const card: BenchmarkCard = { kind: "benchmark", rows };
  const model = {
    shown_as: "comparison card",
    basis: "24 months; peers are customers in the same age band who spend in that category",
    rows: rows.map(({ tx_ids: _ids, ...rest }) => rest),
  };
  return { model, card };
}

async function spenderProfile(input: { period?: (typeof PERIODS)[number] }): Promise<ToolResult> {
  const rows = await callTool<ProfileRow>("spender_profile", { period: input.period });
  const card: ProfileCard = { kind: "profile", rows };
  const model = { shown_as: "persona card", rows: rows.map(({ tx_ids: _ids, ...rest }) => rest) };
  return { model, card };
}

async function listTransactions(input: {
  period: (typeof PERIODS)[number]; from_date?: string; to_date?: string; flow?: Flow; category?: string;
  label?: string; basket?: string; sort?: (typeof SORTS)[number]; max_rows?: number;
}): Promise<ToolResult> {
  const rows = await callTool<TxRow>("list_transactions", {
    period: input.period, from_date: input.from_date, to_date: input.to_date, only_flow: input.flow,
    only_category: input.category, only_label: input.label, only_basket: input.basket,
    sort: input.sort, max_rows: input.max_rows,
  });
  const card: TransactionsCard = { kind: "transactions", title: subjectOf(input), rows };
  const dates = rows.map((row) => row.date).sort();
  const model = {
    shown_as: "transaction list on screen; the rows themselves are not sent to you",
    count: rows.length,
    first_date: dates[0] ?? null,
    last_date: dates.at(-1) ?? null,
    labels: [...new Set(rows.map((row) => row.label))],
  };
  return { model, card };
}

/** The rows behind a card, by id, for "show transactions". Always this customer's rows only. */
export function transactionsByIds(ids: number[]): Promise<TxRow[]> {
  return callTool<TxRow>("list_transactions", { ids });
}

// ------------------------------------------------------------------ definitions for the model

type Vocab = { categories: [string, ...string[]]; labels: [string, ...string[]] };

async function loadVocab(): Promise<Vocab> {
  const categories = (await query<{ v: string }>("select distinct category as v from transactions order by 1")).map((r) => r.v);
  const labels = (await query<{ v: string }>("select distinct label as v from transactions where flow = 'spending' order by 1")).map((r) => r.v);
  return { categories: categories as Vocab["categories"], labels: labels as Vocab["labels"] };
}

function buildSpecs(vocab: Vocab): ToolSpec[] {
  const period = z.enum(PERIODS).describe(
    "last_month = the most recent complete calendar month. all = the whole data window (24 months). " +
    "custom needs from_date and to_date.");
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD; only with period custom");
  const category = z.enum(vocab.categories).describe("Broad category, e.g. Restaurants, Transportation, Groceries");
  const label = z.enum(vocab.labels).describe("Plain merchant type from the card terminal, e.g. Taxi, Restaurant, Fast food, Supermarket, Electronics");
  const subject = z.enum([...new Set([...vocab.categories, ...vocab.labels])] as [string, ...string[]]);
  const basket = z.enum(BASKETS).describe("S-Bank basket: regular (mandatory monthly), irregular (mandatory now and then), everyday (everything else)");
  const flow = z.enum(FLOWS).describe("spending (default), income (money in) or saving (money moved to savings and investments)");

  return [
    tool({
      name: "spend_by",
      description:
        "Add up the customer's money in a period from their transactions, grouped one way. group_by total gives one " +
        "figure, shown as a number card; any other grouping gives a bar chart. Spending is positive euros. Over periods " +
        "longer than a month the result includes per-month averages. Narrow it with label (merchant type such as Taxi), " +
        "category, basket or flow.",
      schema: z.object({
        group_by: z.enum(GROUPINGS),
        period,
        from_date: date.optional(),
        to_date: date.optional(),
        flow: flow.optional(),
        category: category.optional(),
        label: label.optional(),
        basket: basket.optional(),
      }),
      run: spendBy,
    }),
    tool({
      name: "safe_to_spend",
      description:
        "What the customer can safely spend this week, with every line of the calculation: balance now, minus " +
        "basket-one bills due before payday, minus a buffer for irregular costs, minus the savings goal kept aside, " +
        "divided over the days to payday, times seven.",
      schema: z.object({
        savings_goal: z.number().min(0).max(100000).optional()
          .describe("Euros to keep aside before payday; leave out to use the default"),
      }),
      run: safeToSpend,
    }),
    tool({
      name: "simulate_cut",
      description:
        "What-if: cut spending in one category, label or basket by a percentage. Returns the monthly and yearly " +
        "saving and the weekly spend beside this week's safe-to-spend. Shown as a slider card. Name exactly one of " +
        "category, label or basket.",
      schema: z.object({
        category: category.optional(),
        label: label.optional(),
        basket: basket.optional(),
        pct: z.number().int().min(1).max(100).describe("How much to cut, in percent"),
        period: period.optional().describe("Base for the monthly average; leave out for all 24 months"),
      }),
      run: simulateCut,
    }),
    tool({
      name: "suggest_cuts",
      description:
        "Rank the customer's everyday spending by how far it sits above normal - above people their age for a " +
        "long-run habit, or above their own usual month for a jump this month - and show the top three as a " +
        "swipeable stack of Try-it cards, each a what-if slider starting at 20%. Use it when the customer asks what " +
        "to cut, how to save, or for another idea or Try-it card. Pass exclude with ideas already shown.",
      schema: z.object({
        exclude: z.array(subject).max(50).optional()
          .describe("Categories or merchant types already suggested, to get different ideas"),
      }),
      run: suggestCuts,
    }),
    tool({
      name: "benchmark",
      description:
        "Compare the customer's monthly spending per category with S-Bank customers of the same age band who also " +
        "spend in that category: average, median, how many times the average, and percentile. Leave category out to " +
        "compare every category.",
      schema: z.object({ category: category.optional() }),
      run: benchmark,
    }),
    tool({
      name: "spender_profile",
      description:
        "The customer's spender persona, from how their everyday spending splits and when it happens, with three " +
        "evidence lines and one habit to try this week. Shown as a persona card.",
      schema: z.object({ period: period.optional().describe("Leave out for all 24 months") }),
      run: spenderProfile,
    }),
    tool({
      name: "list_transactions",
      description:
        "Show individual transactions as a list card on the customer's screen. You get only a count and date range, " +
        "not the rows. Use when the customer asks to see their transactions.",
      schema: z.object({
        period,
        from_date: date.optional(),
        to_date: date.optional(),
        flow: flow.optional(),
        category: category.optional(),
        label: label.optional(),
        basket: basket.optional(),
        sort: z.enum(SORTS).optional().describe("newest first (default), oldest first, or largest amount first"),
        max_rows: z.number().int().min(1).max(50).optional().describe("Default 50"),
      }),
      run: listTransactions,
    }),
  ];
}

let specsCache: Promise<ToolSpec[]> | undefined;
const specs = () => (specsCache ??= loadVocab().then(buildSpecs));

/** Tool definitions for the Messages API. Same order and text every time, so the prompt cache holds. */
export async function apiTools(): Promise<Anthropic.Beta.BetaTool[]> {
  return (await specs()).map(({ name, description, schema }) => {
    const { $schema: _draft, ...inputSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
    return {
      name,
      description,
      input_schema: inputSchema as Anthropic.Beta.BetaTool.InputSchema,
      eager_input_streaming: true, // inputs stream as generated; validated below before any SQL runs
    };
  });
}

export type ToolOutcome = { ok: true; model: unknown; card: Card } | { ok: false; error: string };

/** Validates the model's input against the tool's schema, then runs it. Never throws. */
export async function executeTool(name: string, input: unknown): Promise<ToolOutcome> {
  const spec = (await specs()).find((s) => s.name === name);
  if (!spec) return { ok: false, error: `Unknown tool: ${name}` };
  const parsed = spec.schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: JSON.stringify({
        INVALID_JSON: JSON.stringify(input),
        problems: parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`),
      }),
    };
  }
  try {
    return { ok: true, ...(await spec.run(parsed.data)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

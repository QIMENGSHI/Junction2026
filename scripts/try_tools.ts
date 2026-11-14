// The app's tool layer, run without the model: the demo questions' tool calls, checked.
//   npm run try:tools
import { BASKETS, CATEGORY_ORDER, categorySlot } from "../lib/category-colors";
import { query } from "../lib/db";
import { systemPrompt } from "../lib/prompt";
import { apiTools, executeTool, transactionsByIds } from "../lib/tools";

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)})`}`);
}
/** The model must never see ids or transaction rows. */
const leaks = (model: unknown) => /tx_ids|amount_eur|balance_after_eur|merchant_id/.test(JSON.stringify(model));

async function main() {
  console.log("Tool definitions sent to the model");
  const tools = await apiTools();
  const names = tools.map((t) => t.name);
  check("seven tools, in a fixed order", names.join() === "spend_by,safe_to_spend,simulate_cut,suggest_cuts,benchmark,spender_profile,list_transactions", names);
  check("every tool streams its input eagerly", tools.every((t) => t.eager_input_streaming === true));
  const spendSchema = JSON.stringify(tools[0].input_schema);
  check("spend_by offers real labels (Taxi) and categories (Restaurants)", spendSchema.includes('"Taxi"') && spendSchema.includes('"Restaurants"'));
  check("definitions are identical on every call (prompt cache holds)", JSON.stringify(tools) === JSON.stringify(await apiTools()));

  console.log('\nQ2 "How much did I spend on taxis last month?"');
  const q2 = await executeTool("spend_by", { group_by: "total", label: "Taxi", period: "last_month" });
  if (q2.ok && q2.card.kind === "number") {
    console.log("   card:", { title: q2.card.title, eur: q2.card.eur, n: q2.card.n, period: q2.card.period });
    console.log("   model sees:", JSON.stringify(q2.model));
    check("number card: €207.65 over 3 transactions in September 2026",
      q2.card.eur === 207.65 && q2.card.n === 3 && q2.card.period.start === "2026-09-01" && q2.card.period.end === "2026-09-30");
    check("the model sees figures but no ids", !leaks(q2.model));
    const rows = await transactionsByIds(q2.card.tx_ids);
    check("show transactions: the 3 taxi rows, newest first", rows.length === 3 && rows.every((r) => r.label === "Taxi") && rows[0].date === "2026-09-30", rows.map((r) => r.date));
  } else check("spend_by answered", false, q2);

  console.log('\nQ3 "Where does my money really go?"');
  const q3a = await executeTool("spend_by", { group_by: "basket", period: "all" });
  const q3b = await executeTool("spend_by", { group_by: "category", basket: "everyday", period: "all" });
  if (q3a.ok && q3a.card.kind === "bars" && q3b.ok && q3b.card.kind === "bars") {
    console.log("   baskets per month:", q3a.card.rows.map((r) => `${r.key} ${r.per_month_eur}`).join(", "));
    console.log("   everyday per month:", q3b.card.rows.map((r) => `${r.key} ${r.per_month_eur}`).join(", "));
    check("bar chart: everyday basket €1,347.60 a month", q3a.card.rows.find((r) => r.key === "everyday")?.per_month_eur === 1347.6);
    check("bar chart: restaurants lead the everyday basket at €540.34 a month", q3b.card.rows[0].key === "Restaurants" && q3b.card.rows[0].per_month_eur === 540.34);
    check("the model sees no ids", !leaks(q3a.model) && !leaks(q3b.model));
  } else check("spend_by grouped answered", false, [q3a, q3b]);

  console.log("\nHome: the baskets card and its flip side (this month)");
  const front = await executeTool("spend_by", { group_by: "basket", period: "this_month" });
  if (front.ok && front.card.kind === "bars") {
    for (const basket of BASKETS) {
      const split = await executeTool("spend_by", { group_by: "category", basket, period: "this_month" });
      const row = front.card.rows.find((r) => r.key === basket);
      const ok = split.ok && split.card.kind === "bars" && row !== undefined
        && split.card.total.eur === row.eur
        && split.card.rows.reduce((cents, r) => cents + Math.round(r.eur * 100), 0) === Math.round(row.eur * 100)
        && split.card.rows.every((r) => categorySlot(basket, r.key) !== null);
      check(`${basket}: categories add up to the front's ${row?.eur} to the cent, each with a color`, ok,
        split.ok && split.card.kind === "bars" && split.card.rows.map((r) => [r.key, r.eur]));
    }
  } else check("spend_by by basket answered", false, front);
  const seen = await query<{ basket: string; categories: string[] }>(`select basket, list(distinct category order by category) as categories
    from transactions where flow = 'spending' group by basket order by basket`);
  check("every category any basket holds (all rows) has a color slot in that basket",
    seen.every(({ basket, categories }) => categories.every((c) => categorySlot(basket as (typeof BASKETS)[number], c) !== null)), seen);
  check("no two categories share a color slot within a basket",
    BASKETS.every((b) => new Set(CATEGORY_ORDER[b]).size === CATEGORY_ORDER[b].length && CATEGORY_ORDER[b].length <= 6));

  console.log("\nThe other five tools");
  const safe = await executeTool("safe_to_spend", {});
  check("safe_to_spend: €467.40 this week (€2,000 kept aside)",
    safe.ok && safe.card.kind === "safe_to_spend" && safe.card.lines.find((l) => l.key === "weekly")?.eur === 467.4, safe);
  const cut = await executeTool("simulate_cut", { category: "Restaurants", pct: 20 });
  check("simulate_cut: 20% of restaurants saves €108.07 a month",
    cut.ok && cut.card.kind === "cut" && cut.card.monthly_saving === 108.07 && cut.card.pct_steps.length === 21, cut);
  const bench = await executeTool("benchmark", { category: "Restaurants" });
  check("benchmark: 2.8× peers, 98th percentile",
    bench.ok && bench.card.kind === "benchmark" && bench.card.rows[0].times_peer_avg === 2.8 && bench.card.rows[0].percentile === 98, bench);
  const profile = await executeTool("spender_profile", {});
  check("spender_profile: Night-out spender", profile.ok && profile.card.kind === "profile" && profile.card.rows[0].title === "Night-out spender", profile);
  const list = await executeTool("list_transactions", { period: "last_month", label: "Taxi" });
  check("list_transactions: 3 rows on screen, the model gets only a count",
    list.ok && list.card.kind === "transactions" && list.card.rows.length === 3 && !leaks(list.model), list.ok && list.model);
  const ideas = await executeTool("suggest_cuts", {});
  if (ideas.ok && ideas.card.kind === "ideas") {
    const stack = ideas.card.ideas;
    console.log("   Try-it stack:", stack.map((i) => `${i.key} ${i.reason} +${i.excess_eur}`).join(", "));
    check("suggest_cuts: Restaurants (+€343.93 vs peers), Entertainment (+€299.71), Taxi (+€191.53 vs usual)",
      stack.map((i) => `${i.key}:${i.reason}:${i.excess_eur}`).join() === "Restaurants:peers:343.93,Entertainment:peers:299.71,Taxi:usual:191.53",
      stack.map((i) => `${i.key}:${i.reason}:${i.excess_eur}`));
    check("each idea carries its own what-if card; idea 1 at 20% saves €108.07 a month",
      stack.every((i) => i.cut.kind === "cut" && i.cut.pct_steps.length === 21 && i.cut.cut_pct === 20)
        && stack[0].cut.monthly_saving === 108.07 && stack[2].cut.title === "Taxi" && stack[2].cut.monthly_now === 207.65,
      stack.map((i) => [i.cut.title, i.cut.monthly_now, i.cut.monthly_saving]));
    const other = await executeTool("suggest_cuts", { exclude: ["Restaurants"] });
    check("exclude gives other ideas: Entertainment, Taxi, Parking",
      other.ok && other.card.kind === "ideas" && other.card.ideas.map((i) => i.key).join() === "Entertainment,Taxi,Parking",
      other.ok && other.card.kind === "ideas" && other.card.ideas.map((i) => i.key));
  } else check("suggest_cuts answered", false, ideas);
  check("no tool leaks ids or rows to the model", [safe, cut, ideas, bench, profile].every((r) => r.ok && !leaks(r.model)));

  console.log("\nBad input");
  const bad = await executeTool("spend_by", { group_by: "vibes", period: "all" });
  check("an invalid input is refused before any SQL runs, with INVALID_JSON for the model",
    !bad.ok && bad.error.includes("INVALID_JSON") && bad.error.includes("group_by"), bad);
  const none = await executeTool("simulate_cut", { pct: 20 });
  check("simulate_cut without a target explains what is missing", !none.ok && none.error.startsWith("Name what to cut"), none);

  console.log("\nSystem prompt facts (all read from the database)");
  const prompt = await systemPrompt();
  for (const line of prompt.split("\n").filter((l) => l.startsWith("- Today") || l.startsWith("- \"Last") || l.startsWith("- The customer") || l.startsWith("- Safe"))) {
    console.log("  ", line);
  }
  check("prompt names September 2026 as last month and a €2,000 goal",
    prompt.includes("most recent complete month: September 2026") && prompt.includes("€2,000.00"));

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nall tool-layer checks passed");
  process.exit(failed ? 1 : 0);
}

main();

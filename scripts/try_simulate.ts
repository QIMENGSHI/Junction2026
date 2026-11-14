// Integration tests only touch an isolated copy; never use MotherDuck or the checked-in DB.
import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "kori-simulate-"));
  process.env.KORI_DB_PATH = path.join(directory, "test.duckdb");
  process.env.KORI_DB_WRITABLE = "1";
  process.env.KORI_CUSTOMER = "CUST04414";
  delete process.env.MOTHERDUCK_TOKEN;
  await copyFile("db/kori.duckdb", process.env.KORI_DB_PATH);
  const { query, instance } = await import("../lib/db");
  const { addPurchase, listPurchases, resetPurchases } = await import("../lib/purchases");
  const { executeTool, transactionsByIds } = await import("../lib/tools");
  const weekly = async () => (await query<{ eur: number }>("select eur from safe_to_spend($customer) where key='weekly'", { customer: "CUST04414" }))[0].eur;
  try {
    const [classification] = await query<{ n: number }>(`select count(*)::integer as n
      from transactions t left join mcc_labels l using (mcc_code)
      where t.label <> coalesce(l.label, t.category)
      or t.flow <> case when category in ('Salary','Other Income') then 'income'
                       when category in ('Invest Deposit','Invest Withdraw','Salary Sweep') then 'saving' else 'spending' end
      or t.basket is distinct from case
        when category in ('Salary','Other Income','Invest Deposit','Invest Withdraw','Salary Sweep') then null
        when category in ('Housing','Utilities','Groceries') then 'regular'
        when category='Transportation' and mcc_code in (4111,5541,5542) then 'regular'
        when category='Health' or (category='Home & Tech' and tx_amount_eur<=-400) then 'irregular' else 'everyday' end`);
    assert.equal(classification.n, 0);
    assert.equal(await weekly(), 467.4);
    const before = await executeTool("spend_by", { group_by: "total", category: "Restaurants", period: "last_month" });
    assert(before.ok && before.card.kind === "number");
    const monthBefore = await executeTool("spend_by", { group_by: "basket", period: "this_month" });
    assert(monthBefore.ok && monthBefore.card.kind === "bars");
    const benchmarkBefore = await executeTool("benchmark", { category: "Restaurants" });
    assert(benchmarkBefore.ok && benchmarkBefore.card.kind === "benchmark");
    const profileBefore = await executeTool("spender_profile", {});
    assert(profileBefore.ok && profileBefore.card.kind === "profile");
    const first = await addPurchase({ preset: "dinner" });
    assert.equal(first.purchases.length, 1);
    assert.equal(await weekly(), 397.4);
    const [balance] = await query<{ balance_after_eur: number }>("select balance_after_eur from transactions where merchant_id='SIMULATED'");
    assert.equal(balance.balance_after_eur, 4033.34);
    const after = await executeTool("spend_by", { group_by: "total", category: "Restaurants", period: "last_month" });
    assert(after.ok && after.card.kind === "number");
    assert.equal(after.card.eur, Math.round((before.card.eur + 150) * 100) / 100);
    assert.equal(after.card.n, before.card.n + 1);
    const rows = await transactionsByIds([first.purchases[0].tx_id]);
    assert.equal(rows[0].merchant_id, "SIMULATED");
    const benchmarkAfter = await executeTool("benchmark", { category: "Restaurants" });
    assert(benchmarkAfter.ok && benchmarkAfter.card.kind === "benchmark");
    assert.equal(benchmarkAfter.card.rows[0].your_purchases, benchmarkBefore.card.rows[0].your_purchases + 1);
    const profileAfter = await executeTool("spender_profile", {});
    assert(profileAfter.ok && profileAfter.card.kind === "profile");
    assert.notEqual(profileAfter.card.rows.find((r) => r.key === "vs_peers")?.text,
      profileBefore.card.rows.find((r) => r.key === "vs_peers")?.text);

    const monthAfterDinner = await executeTool("spend_by", { group_by: "basket", period: "this_month" });
    assert(monthAfterDinner.ok && monthAfterDinner.card.kind === "bars");
    assert.equal(Math.round(monthAfterDinner.card.total.eur * 100) - Math.round(monthBefore.card.total.eur * 100), 15000);

    // Reproduce the screenshot: €3,195 everyday spending and €1,000 groceries.
    // Actual monthly spending must include the full purchases; historical averages divide by 24.
    await addPurchase({ preset: "taxi" });
    for (let i = 0; i < 3; i++) await addPurchase({ preset: "taxi", amount_eur: 1000 });
    await addPurchase({ preset: "groceries", amount_eur: 1000 });
    const historical = await executeTool("spend_by", { group_by: "basket", period: "all" });
    assert(historical.ok && historical.card.kind === "bars");
    assert.equal(historical.card.rows.find((r) => r.key === "regular")?.per_month_eur, 1481.89);
    assert.equal(historical.card.rows.find((r) => r.key === "everyday")?.per_month_eur, 1480.72);
    assert.equal(historical.card.total.per_month_eur, 3242.63);
    assert.equal(historical.card.monthly_rounding_eur, 0.01);
    const roundedParts = historical.card.rows.reduce((cents, r) => cents + Math.round(r.per_month_eur * 100), 0);
    assert.equal(roundedParts + Math.round(historical.card.monthly_rounding_eur * 100), Math.round(historical.card.total.per_month_eur * 100));

    const currentMonth = await executeTool("spend_by", { group_by: "basket", period: "this_month" });
    assert(currentMonth.ok && currentMonth.card.kind === "bars");
    assert.equal(currentMonth.card.period.months, 1);
    assert.equal(currentMonth.card.total.eur, 7972.73);
    assert.equal(Math.round(currentMonth.card.total.eur * 100) - Math.round(monthBefore.card.total.eur * 100), 419500);
    assert.equal(currentMonth.card.rows.reduce((cents, r) => cents + Math.round(r.eur * 100), 0), 797273);
    for (const basket of currentMonth.card.rows) {
      const transactions = await transactionsByIds(basket.tx_ids);
      assert(transactions.every((r) => r.date >= "2026-09-01" && r.date <= "2026-09-30"));
      assert.equal(transactions.reduce((cents, r) => cents - Math.round(r.amount_eur * 100), 0), Math.round(basket.eur * 100));
    }
    await resetPurchases();
    assert.equal(await weekly(), 467.4);
    await addPurchase({ preset: "dentist" });
    const [buffer] = await query<{ actual: number; expected: number }>(`select
      (select -eur from safe_to_spend($c) where key='buffer') as actual,
      (select round((sum(irregular_eur)+480)/12*15/30.4375,2)::double from monthly_baskets
       where customer_id=$c and month between date '2025-10-01' and date '2026-09-30') as expected`, { c: "CUST04414" });
    assert.equal(buffer.actual, buffer.expected);
    await resetPurchases();
    const [taxi, grocery] = await Promise.all([addPurchase({ preset: "taxi", amount_eur: 45.55 }), addPurchase({ preset: "groceries" })]);
    assert(taxi.purchases.length >= 1 && grocery.purchases.length === 2);
    const [chain] = await query<{ n: number }>(`select count(*)::integer as n from (
      select balance_after_eur-tx_amount_eur as before, lag(balance_after_eur) over (order by tx_id) as prev
      from transactions where customer_id='CUST04414') where before<>prev`);
    assert.equal(chain.n, 0);
    const currentVersion = (await listPurchases()).version;
    for (const input of [{ preset: "dinner", amount_eur: 0 }, { preset: "dinner", amount_eur: 5001 }, { preset: "dinner", amount_eur: 1.001 }, { preset: "unknown" }]) {
      await assert.rejects(addPurchase(input));
    }
    assert.equal((await listPurchases()).version, currentVersion);
    for (let i = 2; i < 20; i++) await addPurchase({ preset: "taxi", amount_eur: 1 });
    await assert.rejects(addPurchase({ preset: "dinner" }), /20 purchases/);
    assert.equal((await listPurchases()).purchases.length, 20);
    const fullVersion = (await listPurchases()).version;
    await resetPurchases();
    assert.equal(await weekly(), 467.4);
    assert.notEqual((await listPurchases()).version, fullVersion);
    const route = await import("../app/api/purchases/route");
    const request = (origin: string, body: string) => new Request("https://kori.test/api/purchases", {
      method: "POST", headers: { origin, "content-type": "application/json" }, body,
    });
    assert.equal((await route.POST(request("https://other.test", '{"preset":"dinner"}'))).status, 403);
    assert.equal((await route.POST(request("https://kori.test", "invalid"))).status, 400);
    assert.equal((await route.POST(request("https://kori.test", '{"preset":"dinner"}'))).status, 200);
    assert.equal(await weekly(), 397.4);
    const response = await route.GET();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).purchases.length, 1);
    assert.equal((await route.DELETE(new Request("https://kori.test/api/purchases", {
      method: "DELETE", headers: { origin: "https://kori.test" },
    }))).status, 200);
    assert.equal(await weekly(), 467.4);
    console.log("All purchase integration checks passed: baseline, dinner, basket reconciliation, rounding, dentist, live tools, reset, balances, validation, concurrency and cap.");
  } finally {
    (await instance()).closeSync();
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

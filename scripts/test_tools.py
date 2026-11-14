"""Block 2 tests: the seven tools in kori/sql/tools.sql answer the demo with the right numbers.

    python kori/scripts/test_tools.py      # exits 1 if any check fails; build_db.py runs it too

Part 1 walks the 3-minute demo and prints each answer the way its card would show it.
Part 2 recomputes safe-to-spend by hand, in plain Python from raw rows, without the tools.
Part 3 guards the tools: every filter filters, totals add up, one customer cannot read
another's rows, bad input fails loudly, and all six run for a sample of customers and dates.
"""
import calendar
import datetime as dt
import pathlib
import statistics
import sys
import time
from decimal import ROUND_HALF_UP, Decimal

import duckdb

DB = pathlib.Path(__file__).resolve().parents[1] / "db" / "kori.duckdb"
DEMO = "CUST04414"
CENT = Decimal("0.01")


class Checks:
    def __init__(self):
        self.passed = self.failed = 0

    def __call__(self, name, ok, got=None):
        self.passed += bool(ok)
        self.failed += not ok
        print(f"   {'ok  ' if ok else 'FAIL'}  {name}" + ("" if ok else f"  (got {got})"))


def q(con, sql, **params):
    r = con.execute(sql, params)
    cols = [d[0] for d in r.description]
    return [dict(zip(cols, row)) for row in r.fetchall()]


def eur(x):
    return f"€{float(x):,.2f}"


def same(a, b, tol="0"):
    return a is not None and abs(Decimal(str(a)) - Decimal(str(b))) <= Decimal(tol)


# ---------------------------------------------------------------- part 1: the demo

def demo(con, check):
    print('\n1  Home: "Safe to spend this week" above the three-basket bar')
    lines = q(con, "select * from safe_to_spend($c)", c=DEMO)
    for r in lines:
        print(f"   {r['label']:<30}{eur(r['eur']):>12}   {r['note']}")
    key = {r["key"]: r for r in lines}
    weekly = key["weekly"]
    check("next salary 15 Oct, 15 days away", (weekly["payday"], weekly["days_to_payday"]) == ("2026-10-15", 15),
          (weekly["payday"], weekly["days_to_payday"]))
    check("rent due 6 Oct counts in full; groceries, transport, utilities at the usual pace",
          [r["label"] for r in lines if r["key"] == "bill"]
          == ["Housing due 6 Oct", "Groceries until payday", "Transportation until payday", "Utilities until payday"],
          [r["label"] for r in lines if r["key"] == "bill"])
    check("the default savings goal keeps €2,000 aside", key["goal"]["eur"] == Decimal("-2000.00"), key.get("goal"))
    check("safe to spend this week = €467.40", weekly["eur"] == Decimal("467.40"), weekly["eur"])
    without = q(con, "select eur from safe_to_spend($c, savings_goal := 0) where key = 'weekly'", c=DEMO)[0]["eur"]
    check("with no savings goal it would be €1,400.74", without == Decimal("1400.74"), without)
    bar = {r["key"]: r["eur"] for r in q(con, "select key, eur from spend_by($c, group_by := 'basket', period := 'this_month')", c=DEMO)}
    print("   basket bar, Sep 2026: " + ", ".join(f"{k} {eur(v)}" for k, v in bar.items()))
    check("basket bar: regular 1,439.70, everyday 1,203.56, irregular 1,134.47",
          bar == {"regular": Decimal("1439.70"), "everyday": Decimal("1203.56"),
                  "irregular": Decimal("1134.47"), "Total": Decimal("3777.73")}, bar)

    print('\n2  "How much did I spend on taxis last month?"')
    taxi = q(con, "select * from spend_by($c, group_by := 'total', only_label := 'Taxi', period := 'last_month')", c=DEMO)[0]
    print(f"   {eur(taxi['eur'])} on {taxi['n']} rides, {taxi['period_start']} to {taxi['period_end']}")
    check("€207.65 over 3 rides in September 2026",
          (taxi["eur"], taxi["n"], taxi["period_start"], taxi["period_end"]) == (Decimal("207.65"), 3, "2026-09-01", "2026-09-30"),
          (taxi["eur"], taxi["n"]))
    shown = q(con, "select * from list_transactions($c, ids := $ids)", c=DEMO, ids=taxi["tx_ids"])
    for r in shown:
        print(f"   {r['date']} {r['time']}  {r['label']:<6}{eur(r['amount_eur']):>10}")
    check("How I calculated this: the rows behind it are 3 taxis adding up to 207.65",
          len(shown) == 3 and all(r["label"] == "Taxi" for r in shown)
          and -sum(r["amount_eur"] for r in shown) == taxi["eur"], len(shown))

    print('\n3  "Where does my money really go?"')
    baskets = q(con, "select * from spend_by($c, group_by := 'basket')", c=DEMO)
    for r in baskets:
        print(f"   {r['key']:<10}{eur(r['per_month_eur']):>12} a month  {r['share_pct']:>5}%")
    everyday = next(r for r in baskets if r["key"] == "everyday")
    check("about €1,350 a month slips through the everyday basket (1,347.60)",
          same(everyday["per_month_eur"], "1347.60"), everyday["per_month_eur"])
    cats = q(con, "select * from spend_by($c, group_by := 'category', only_basket := 'everyday')", c=DEMO)
    print("   everyday by category: " + ", ".join(f"{r['key']} {eur(r['per_month_eur'])}" for r in cats if not r["is_total"]))
    check("restaurants alone are €540 a month (540.34), the largest everyday category",
          cats[0]["key"] == "Restaurants" and same(cats[0]["per_month_eur"], "540.34"), cats[0])

    print('\n4  "What if I cut dining out by 20%?"')
    cut = q(con, "select * from simulate_cut($c, only_category := 'Restaurants', pct := 20)", c=DEMO)[0]
    print(f"   {eur(cut['monthly_now'])} a month -> {eur(cut['monthly_after'])}: saves {eur(cut['monthly_saving'])} "
          f"a month, {eur(cut['yearly_saving'])} a year")
    print(f"   per week {eur(cut['weekly_now'])} -> {eur(cut['weekly_after'])}, beside {eur(cut['safe_to_spend_week'])} safe to spend")
    check("20% saves €108.07 a month and €1,296.82 a year",
          same(cut["monthly_saving"], "108.07") and same(cut["yearly_saving"], "1296.82"), cut["monthly_saving"])
    check("slider: 21 steps, 0 to 100%, nothing saved at 0%, nothing left at 100%",
          cut["pct_steps"] == list(range(0, 101, 5)) and cut["monthly_saving_steps"][0] == 0
          and cut["weekly_after_steps"][-1] == 0 and same(cut["monthly_saving_steps"][4], cut["monthly_saving"]), cut["pct_steps"])

    print('\n5  "Is that normal for my age?"')
    b = q(con, "select * from benchmark($c, only_category := 'Restaurants')", c=DEMO)[0]
    print(f"   you {eur(b['you_per_month'])} a month; ages {b['age_band']} average {eur(b['peers_avg_per_month'])} "
          f"(median {eur(b['peers_median_per_month'])}, {b['peers_counted']} people)")
    print(f"   {b['times_peer_avg']}x the average; more than {b['percentile']}% of them")
    check("540.34 vs 196.41 for ages 25-34: 2.8x, 98th percentile",
          (b["you_per_month"], b["peers_avg_per_month"], b["times_peer_avg"], b["percentile"])
          == (Decimal("540.34"), Decimal("196.41"), 2.8, 98), (b["times_peer_avg"], b["percentile"]))

    print('\n6  "What kind of spender am I?"')
    prof = q(con, "select * from spender_profile($c)", c=DEMO)
    for r in prof:
        print(f"   {r['kind']:<9}{r['title']}: {r['text']}")
    kinds = [r["kind"] for r in prof]
    check("Night-out spender, 3 evidence lines and 1 habit, each backed by transactions",
          prof[0]["title"] == "Night-out spender" and kinds == ["persona", "evidence", "evidence", "evidence", "habit"]
          and all(r["tx_ids"] for r in prof), (prof[0]["title"], kinds))

    print("\n7  The washing machine (the demo's last beat)")
    two = q(con, "select * from spend_by($c, group_by := 'label', only_basket := 'irregular', period := 'last_month')", c=DEMO)
    print(f"   basket two in September: {', '.join(f'{r['key']} {eur(r['eur'])}' for r in two if not r['is_total'])}")
    print(f"   setting aside {eur(key['irregular_avg']['eur'])} a month covers basket two on average")
    check("September's basket two is the 1,134.47 electronics purchase; the set-aside is 300.05 a month",
          [(r["key"], r["eur"]) for r in two if not r["is_total"]] == [("Electronics", Decimal("1134.47"))]
          and key["irregular_avg"]["eur"] == Decimal("300.05"), two)

    print("\n8  The Try-it stack (Home): everyday spending furthest above normal")
    ideas = q(con, "select * from suggest_cuts($c)", c=DEMO)
    for r in ideas:
        normal = eur(r["normal_eur"]) if r["normal_eur"] is not None else "-"
        print(f"   {r['rank']}. {r['key']:<14}{r['reason']:<7}{eur(r['you_eur']):>10} vs {normal:>9}  above by {eur(r['excess_eur'])}")
    check("Restaurants +343.93 vs peers, Entertainment +299.71 vs peers, Taxi +191.53 vs your usual",
          [(r["key"], r["reason"], r["period"], r["you_eur"], r["normal_eur"], r["excess_eur"]) for r in ideas]
          == [("Restaurants", "peers", "all", Decimal("540.34"), Decimal("196.41"), Decimal("343.93")),
              ("Entertainment", "peers", "all", Decimal("434.21"), Decimal("134.50"), Decimal("299.71")),
              ("Taxi", "usual", "this_month", Decimal("207.65"), Decimal("16.12"), Decimal("191.53"))],
          [(r["key"], r["excess_eur"]) for r in ideas])
    first = q(con, """select monthly_saving from simulate_cut($c, only_category := 'Restaurants', only_basket := 'everyday',
                      period := 'all')""", c=DEMO)[0]["monthly_saving"]
    check("idea 1's card, cut by 20%, saves €108.07 a month", same(first, "108.07"), first)


# ---------------------------------------------------------------- part 2: by hand

def add_months(d, n):
    y, m = divmod(d.month - 1 + n, 12)
    y, m = d.year + y, m + 1
    return dt.date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def cents(x):
    return Decimal(x).quantize(CENT, ROUND_HALF_UP)


def safe_to_spend_by_hand(con, customer, goal=Decimal("2000")):
    """The formula from CLAUDE.md, worked in Python from the raw transactions."""
    today = con.execute("select value::date from meta where key = 'today'").fetchone()[0]
    tx = q(con, """select tx_date, category, basket, tx_amount_eur as amount, balance_after_eur as balance
                   from transactions where customer_id = $c and tx_date <= $t order by tx_id""", c=customer, t=today)
    balance = tx[-1]["balance"]

    pay_day = statistics.mode(t["tx_date"].day for t in tx if t["category"] == "Salary")
    month = today.replace(day=1)
    payday = month.replace(day=min(pay_day, calendar.monthrange(month.year, month.month)[1]))
    if payday <= today:
        month = add_months(month, 1)
        payday = month.replace(day=min(pay_day, calendar.monthrange(month.year, month.month)[1]))
    days = (payday - today).days

    since = add_months(today, -6)
    window = (today - since).days
    bills = {}
    for cat in sorted({t["category"] for t in tx if t["basket"] == "regular"}):
        rows = [t for t in tx if t["category"] == cat and t["basket"] == "regular" and t["tx_date"] > since]
        dom = [t["tx_date"].day for t in rows]
        if 5 <= len(rows) <= 7 and max(dom) - min(dom) <= 10:        # paid monthly on a steady day
            nxt = add_months(max(t["tx_date"] for t in rows).replace(day=1), 1)
            usual_day = int(Decimal(statistics.median(dom)).quantize(Decimal(1), ROUND_HALF_UP))
            due = nxt.replace(day=min(usual_day, calendar.monthrange(nxt.year, nxt.month)[1]))
            bills[cat] = cents(statistics.median(-t["amount"] for t in rows)) if due < payday else Decimal(0)
        else:                                                         # the usual pace, for the days left
            bills[cat] = cents(sum(-t["amount"] for t in rows) / window * days)

    # basket two over the last 12 complete months (September counts: today is its last day)
    last_full = (today.replace(day=1) if today.day == calendar.monthrange(today.year, today.month)[1]
                 else add_months(today.replace(day=1), -1))
    first = add_months(last_full, -11)
    end = last_full.replace(day=calendar.monthrange(last_full.year, last_full.month)[1])
    irregular = sum(-t["amount"] for t in tx if t["basket"] == "irregular" and first <= t["tx_date"] <= end)
    buffer = cents(irregular / 12 * days / Decimal("30.4375"))

    available = balance - sum(bills.values()) - buffer - goal
    return {"balance": balance, "payday": payday, "days": days, "bills": bills, "buffer": buffer, "goal": goal,
            "available": available, "weekly": max(cents(available / days * 7), Decimal(0))}


def by_hand(con, check):
    print(f"\nBy hand: safe to spend for {DEMO}, recomputed in Python from raw rows")
    h = safe_to_spend_by_hand(con, DEMO)
    tool = {(r["key"], r["label"].split(" ")[0]): r for r in q(con, "select * from safe_to_spend($c)", c=DEMO)}
    print(f"   balance {eur(h['balance'])}; payday {h['payday']} in {h['days']} days")
    for cat, amount in h["bills"].items():
        print(f"   {cat:<16}{eur(-amount):>12}")
    print(f"   buffer          {eur(-h['buffer']):>12}\n   savings goal    {eur(-h['goal']):>12}"
          f"\n   left            {eur(h['available']):>12}\n   per week        {eur(h['weekly']):>12}")
    tool_bills = {k[1]: -r["eur"] for k, r in tool.items() if k[0] == "bill"}
    hand_bills = {k: v for k, v in h["bills"].items() if v > 0}
    check("each basket-one line agrees with the tool to the cent",
          tool_bills.keys() == hand_bills.keys() and all(same(tool_bills[k], hand_bills[k], "0.01") for k in hand_bills),
          (tool_bills, hand_bills))
    check("buffer, amount left and weekly figure agree to the cent",
          same(-tool[("buffer", "Irregular")]["eur"], h["buffer"], "0.01")
          and same(tool[("available", "Left")]["eur"], h["available"], "0.01")
          and same(tool[("weekly", "Safe")]["eur"], h["weekly"], "0.01"),
          (tool[("weekly", "Safe")]["eur"], h["weekly"]))

    taxi = q(con, """select tx_date, -tx_amount_eur as eur from transactions
                     where customer_id = $c and label = 'Taxi' and basket = 'everyday'""", c=DEMO)
    this_month = sum(r["eur"] for r in taxi if dt.date(2026, 9, 1) <= r["tx_date"] <= dt.date(2026, 9, 30))
    usual = cents(sum(r["eur"] for r in taxi if dt.date(2025, 9, 1) <= r["tx_date"] <= dt.date(2026, 8, 31)) / 12)
    idea = next(r for r in q(con, "select * from suggest_cuts($c)", c=DEMO) if r["key"] == "Taxi")
    print(f"   Taxi this month {eur(this_month)}; usual month (Sep 2025-Aug 2026) {eur(usual)}")
    check("the Taxi idea agrees with raw rows: this month, usual month, and the gap",
          (idea["you_eur"], idea["normal_eur"], idea["excess_eur"]) == (this_month, usual, this_month - usual),
          (idea["you_eur"], idea["normal_eur"], idea["excess_eur"]))


# ---------------------------------------------------------------- part 3: guards

def guards(con, check):
    print("\nGuards")
    # Each filter must really filter: a parameter that shares a column's name is silently ignored.
    filters = {
        "only_category := 'Restaurants'": lambda r: r["category"] == "Restaurants",
        "only_label := 'Taxi'": lambda r: r["label"] == "Taxi",
        "only_basket := 'irregular'": lambda r: r["basket"] == "irregular",
        "only_mcc := 4121": lambda r: r["mcc_code"] == 4121,
        "only_merchant := 'MRC-TRN-0053'": lambda r: r["merchant_id"] == "MRC-TRN-0053",
    }
    everything = q(con, "select eur from spend_by($c, group_by := 'total')", c=DEMO)[0]["eur"]
    broken = []
    for arg, test in filters.items():
        total = q(con, f"select eur, tx_ids from spend_by($c, group_by := 'total', {arg})", c=DEMO)[0]
        rows = q(con, f"select * from list_transactions($c, {arg}, max_rows := 100000)", c=DEMO)
        if not (0 < total["eur"] < everything and rows and all(test(r) for r in rows)
                and sorted(r["tx_id"] for r in rows) == total["tx_ids"]):
            broken.append(arg)
    check("every filter filters, in spend_by and list_transactions alike", not broken, broken)
    income = q(con, "select eur, n from spend_by($c, group_by := 'total', only_flow := 'income')", c=DEMO)[0]
    check("only_flow := 'income' sums money in (salary and other income)", income["eur"] > 0 and income["n"] >= 24, income)
    base = q(con, "select monthly_now from simulate_cut($c, only_basket := 'everyday')", c=DEMO)[0]["monthly_now"]
    check("simulate_cut filters too (everyday basket base = 1,347.60)", same(base, "1347.60"), base)
    mixed = [r["category"] for r in q(con, """select category from transactions where flow = 'spending'
                                              group by category having count(distinct basket) > 1 order by 1""")]
    check("only Transportation and Home & Tech mix baskets (suggest_cuts splits those two by label)",
          mixed == ["Home & Tech", "Transportation"], mixed)
    check("benchmark only_category returns that one category",
          [r["category"] for r in q(con, "select category from benchmark($c, only_category := 'Travel')", c=DEMO)] == ["Travel"])

    # Totals add up for every grouping.
    bad = []
    for g in ("category", "label", "basket", "merchant", "month", "weekday"):
        rows = q(con, f"select * from spend_by($c, group_by := '{g}', period := 'last_12_months')", c=DEMO)
        parts, total = [r for r in rows if not r["is_total"]], rows[-1]
        if not (total["is_total"] and sum(r["eur"] for r in parts) == total["eur"]
                and sorted(i for r in parts for i in r["tx_ids"]) == total["tx_ids"]):
            bad.append(g)
    check("spend_by groups add up to the Total row, ids included, for every group_by", not bad, bad)
    months = [r["key"] for r in q(con, "select key from spend_by($c, group_by := 'month') where not is_total", c=DEMO)]
    check("months come back in calendar order", months == sorted(months) and len(months) == 24, months[:3])
    empty = q(con, "select * from spend_by($c, group_by := 'total', only_label := 'Hotel', period := 'last_month')", c=DEMO)
    check("nothing matching still returns a Total of 0 with no ids",
          [(r["eur"], r["n"], r["tx_ids"]) for r in empty] == [(Decimal("0.00"), 0, [])], empty)

    # Node turns BIGINT into a JS bigint, which JSON.stringify rejects, so no tool may return one.
    wide = [f"{call.split('(')[0]}.{r['column_name']} {r['column_type']}"
            for call in ("safe_to_spend('{c}')", "spend_by('{c}')", "simulate_cut('{c}', only_category := 'Restaurants')",
                         "suggest_cuts('{c}')", "benchmark('{c}')", "spender_profile('{c}')", "list_transactions('{c}')")
            for r in q(con, f"describe select * from {call.format(c=DEMO)}")
            if "BIGINT" in r["column_type"] or "HUGEINT" in r["column_type"]]
    check("no tool returns a BIGINT column (it would break JSON in the Node app)", not wide, wide)

    # One customer can never read another's rows.
    taxi_ids = q(con, "select tx_ids from spend_by($c, group_by := 'total', only_label := 'Taxi')", c=DEMO)[0]["tx_ids"]
    check("list_transactions ignores ids that belong to another customer",
          q(con, "select * from list_transactions('CUST00001', ids := $ids)", ids=taxi_ids) == [])

    # Bad input fails loudly instead of returning a wrong number.
    for name, sql in {"unknown period": "select * from spend_by($c, period := 'fortnight')",
                      "unknown group_by": "select * from spend_by($c, group_by := 'vibes')"}.items():
        try:
            con.execute(sql, {"c": DEMO}).fetchall()
            check(f"{name} raises an error", False, "no error")
        except duckdb.Error as e:
            check(f"{name} raises an error", name in str(e), str(e).splitlines()[0])

    # All six tools, for a sample of customers and three dates in the pay cycle.
    sample = [r[0] for r in con.execute(
        "select customer_id from customers using sample reservoir(120 rows) repeatable (42)").fetchall()] + [DEMO]
    dates = ("2026-09-30", "2026-09-10", "2026-06-03")
    problems, calls, t0 = [], 0, time.perf_counter()
    for c in sample:
        for d in dates:
            try:
                lines = q(con, "select * from safe_to_spend($c, as_of := $d)", c=c, d=d)
                k = {r["key"]: r for r in lines}
                summed = sum(r["eur"] for r in lines if r["kind"] in ("start", "minus"))
                weekly = max((k["available"]["eur"] / k["available"]["days_to_payday"] * 7).quantize(CENT, ROUND_HALF_UP), 0)
                if summed != k["available"]["eur"] or not same(k["weekly"]["eur"], weekly, "0.01") \
                        or k["weekly"]["days_to_payday"] < 1 or k["weekly"]["eur"] < 0:
                    problems.append((c, d, "safe_to_spend lines do not add up"))
                q(con, "select * from spend_by($c, group_by := 'basket', period := 'last_month', as_of := $d)", c=c, d=d)
                q(con, "select * from simulate_cut($c, only_basket := 'everyday', as_of := $d)", c=c, d=d)
                q(con, "select * from benchmark($c)", c=c)
                q(con, "select * from spender_profile($c, as_of := $d)", c=c, d=d)
                q(con, "select * from list_transactions($c, period := 'last_month', as_of := $d)", c=c, d=d)
                ideas = q(con, "select * from suggest_cuts($c, as_of := $d)", c=c, d=d)
                gaps = [r["excess_eur"] for r in ideas if r["excess_eur"] is not None]
                if len(ideas) > 3 or [r["rank"] for r in ideas] != list(range(1, len(ideas) + 1)) \
                        or gaps != sorted(gaps, reverse=True) or any(g < 10 for g in gaps) \
                        or any(r["you_eur"] - r["normal_eur"] != r["excess_eur"] for r in ideas if r["excess_eur"] is not None):
                    problems.append((c, d, "suggest_cuts ranks or figures do not add up"))
                calls += 7
            except duckdb.Error as e:
                problems.append((c, d, str(e).splitlines()[0]))
    ms = (time.perf_counter() - t0) / max(calls, 1) * 1000
    check(f"all seven tools run for {len(sample)} customers x {len(dates)} dates; safe-to-spend adds up "
          f"({ms:.0f} ms per call)", not problems, problems[:3])


def live_equivalence(con, check):
    # Compare unrounded averages, then the rounded reserve, across all customers.
    mismatch = con.execute("""
        with p as (select * from period_bounds('last_12_months', null, null, null)),
        old as (select customer_id, avg(irregular_eur) as eur from monthly_baskets, p
                where month between p.period_start and p.period_end group by customer_id),
        live as (select c.customer_id, coalesce(-sum(t.tx_amount_eur), 0) / any_value(p.period_months) as eur
                 from customers c cross join p left join transactions t
                   on t.customer_id = c.customer_id and t.basket = 'irregular'
                   and t.tx_date between p.period_start and p.period_end group by c.customer_id)
        select count(*) from old join live using (customer_id) where abs(old.eur - live.eur) > 0.00001
    """).fetchone()[0]
    check("live irregular average equals zero-filled monthly average for every customer", mismatch == 0, mismatch)
    sample = con.execute("select customer_id from customers order by customer_id limit 12").fetchall() + [(DEMO,)]
    for (customer,) in sample:
        got = q(con, "select category, you_per_month, your_purchases from benchmark($c)", c=customer)
        expected = {r["category"]: r for r in q(con,
            "select category, per_month_eur, n_tx from customer_category where customer_id = $c", c=customer)}
        check(f"live benchmark matches baseline for {customer}", all(
            r["you_per_month"] == expected[r["category"]]["per_month_eur"]
            and r["your_purchases"] == expected[r["category"]]["n_tx"] for r in got))


def main(db=DB):
    con = duckdb.connect(str(db), read_only=True)
    check = Checks()
    for part in (demo, by_hand, guards, live_equivalence):
        try:
            part(con, check)
        except Exception as e:  # a broken tool fails its part, not the whole run
            check(f"{part.__name__} ran to the end", False, f"{type(e).__name__}: {str(e).splitlines()[0]}")
    con.close()
    print(f"\n{check.passed}/{check.passed + check.failed} tool checks passed")
    return check.failed == 0


if __name__ == "__main__":
    sys.exit(0 if main() else 1)

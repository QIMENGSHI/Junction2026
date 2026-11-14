"""Integrity and demo checks for kori/db/kori.duckdb. build_db.py runs these at the end.

    python kori/scripts/check_db.py      # exits 1 if any check fails

The demo checks pin the numbers the pitch relies on, so a rebuild cannot change them silently.
"""
import pathlib
import sys
from decimal import Decimal

import duckdb

DB = pathlib.Path(__file__).resolve().parents[1] / "db" / "kori.duckdb"
DEMO = "CUST04414"
TODAY = "(select value::date from meta where key = 'today')"

# (what is checked, SQL returning one value, expected value or a test on the value)
CHECKS = [
    ("tx_id runs 1..N with no gaps",
     "select count(distinct tx_id) = count(*) and min(tx_id) = 1 and max(tx_id) = count(*) from transactions",
     True),
    ("every spending row has a basket, no other row does",
     "select count(*) from transactions where (flow = 'spending') <> (basket is not null)",
     0),
    ("every MCC has a label",
     "select count(*) from transactions where mcc_code is not null and label = category",
     0),
    ("monthly_baskets has every customer x month and no NULLs",
     """select count(*) = (select count(*) from customers) * (select value::integer from meta where key = 'months')
               and count(*) filter (where regular_eur is null or irregular_eur is null or everyday_eur is null
                                       or income_eur is null or saved_eur is null) = 0
        from monthly_baskets""",
     True),
    ("peer_category counts every customer in the age band",
     """select count(*) from peer_category p
        join (select age_band, count(*) as n from customers group by 1) c using (age_band)
        where p.customers <> c.n""",
     0),
    ("peer averages skip customers with no spend (housing, 55-64; 1199.19 if zeros counted)",
     "select avg_per_month from peer_category where age_band = '55-64' and category = 'Housing'",
     Decimal("1291.97")),
    ("every balance = previous balance + amount (rows in tx_id order)",
     """select count(*) from (
            select balance_after_eur - tx_amount_eur as before,
                   lag(balance_after_eur) over (partition by customer_id order by tx_id) as prev
            from transactions)
        where before <> prev""",
     0),

    ("demo: age band",
     f"select age_band from customers where customer_id = '{DEMO}'",
     "25-34"),
    ("demo: balance at the end of today",
     f"""select balance_after_eur from transactions
         where customer_id = '{DEMO}' and tx_date <= {TODAY} order by tx_id desc limit 1""",
     Decimal("4183.34")),
    ("demo: salary lands on the 15th",
     f"select mode(day(tx_date)) from transactions where customer_id = '{DEMO}' and category = 'Salary'",
     15),
    ("demo: average salary over the last 12 months is 3,300-3,700",
     f"""select avg(tx_amount_eur) from transactions where customer_id = '{DEMO}'
         and category = 'Salary' and tx_date > {TODAY} - interval 12 month""",
     lambda v: 3300 <= v <= 3700),
    ("demo: housing, median of the last 6 payments, is 600-640",
     f"""select median(-tx_amount_eur) from (select tx_amount_eur from transactions
         where customer_id = '{DEMO}' and category = 'Housing' order by tx_id desc limit 6)""",
     lambda v: 600 <= v <= 640),
    ("demo: restaurants per month",
     f"select per_month_eur from customer_category where customer_id = '{DEMO}' and category = 'Restaurants'",
     Decimal("540.34")),
    ("demo: restaurants per month, peers aged 25-34",
     "select avg_per_month from peer_category where age_band = '25-34' and category = 'Restaurants'",
     Decimal("196.41")),
    ("demo: taxis in Sep 2026",
     f"""select -sum(tx_amount_eur) from transactions where customer_id = '{DEMO}'
         and mcc_code = 4121 and tx_date between '2026-09-01' and '2026-09-30'""",
     Decimal("207.65")),
    ("demo: 1,134.47 electronics on 2026-09-29 is in the irregular basket",
     f"""select count(*) = 1 from transactions where customer_id = '{DEMO}' and tx_date = '2026-09-29'
         and tx_amount_eur = -1134.47 and label = 'Electronics' and basket = 'irregular'""",
     True),
    ("demo: irregular basket, average of the last 12 months",
     f"""select round(avg(irregular_eur), 2) from monthly_baskets
         where customer_id = '{DEMO}' and month > {TODAY} - interval 12 month""",
     Decimal("300.05")),
]


def passes(got, expected):
    if callable(expected):
        return got is not None and expected(got)
    if isinstance(expected, Decimal):
        return got is not None and abs(Decimal(str(got)) - expected) < Decimal("0.005")
    return got == expected


def main(db=DB):
    con = duckdb.connect(str(db), read_only=True)
    failed = 0
    for name, sql, expected in CHECKS:
        try:
            got = con.execute(sql).fetchone()[0]
        except duckdb.Error as e:  # a missing table or column fails this check, not the whole run
            got = str(e).splitlines()[0]
            expected = lambda _: False
        ok = passes(got, expected)
        failed += not ok
        hint = "" if ok or callable(expected) else f", expected {expected}"
        print(f"{'ok  ' if ok else 'FAIL'}  {name}: {got}{hint}")
    con.close()
    print(f"\n{len(CHECKS) - failed}/{len(CHECKS)} checks passed")
    return failed == 0


if __name__ == "__main__":
    sys.exit(0 if main() else 1)

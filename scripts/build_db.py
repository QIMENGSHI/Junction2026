"""Kori block 1: build kori/db/kori.duckdb from the S-Pankki CSVs in Data/.

Usage (from the "Junction 2026" folder):
    pip install -r kori/requirements.txt
    python kori/scripts/build_db.py      # about 5 s, then runs check_db.py

Tables:
    meta               key/value: data window, the demo's `today`, months of data, build info
    customers          one row per customer, with age_band
    mcc_labels         MCC code -> plain-language label
    transactions       every source row, typed, with label, flow and basket
    monthly_baskets    every customer x every month: euros per basket, income, net saved
    customer_category  every customer x spending category: total and per-month euros
    peer_category      per age band x spending category: average and median euros per month,
                       over the customers who spend in that category

Money is DECIMAL(12,2), so sums are exact. In `transactions` money out is
negative, as in the source; in the derived tables spending is positive.
Months with no spending hold 0, never NULL, so averages count them.

It also loads kori/sql/tools.sql: the six tools as table macros (spend_by,
safe_to_spend, simulate_cut, benchmark, spender_profile, list_transactions).
"""
import os
import pathlib
import shutil
import sys
import tempfile

import duckdb

import check_db
import test_tools

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "Data"
OUT = ROOT / "kori" / "db" / "kori.duckdb"
TOOLS = ROOT / "kori" / "sql" / "tools.sql"

# A Home & Tech purchase of at least this many euros is an irregular, hard-to-avoid
# hit (the broken washing machine), not everyday spending.
BIG_HOME = 400

MCC = {
    4111: "Public transport", 4121: "Taxi", 4511: "Flights", 4722: "Travel agency",
    5200: "Home supplies", 5251: "Hardware store", 5411: "Supermarket", 5422: "Butcher / frozen food",
    5451: "Dairy shop", 5499: "Convenience store", 5541: "Fuel", 5542: "Fuel (self-service)",
    5651: "Clothing", 5691: "Clothing", 5712: "Furniture", 5732: "Electronics", 5734: "Software",
    5812: "Restaurant", 5813: "Bar", 5814: "Fast food", 5912: "Pharmacy", 5941: "Sporting goods",
    5942: "Books", 5945: "Toys and hobbies", 5999: "Specialty retail", 7011: "Hotel",
    7512: "Car rental", 7523: "Parking", 7832: "Cinema", 7922: "Tickets and events",
    7991: "Attractions", 7996: "Amusement park", 7999: "Recreation", 8011: "Doctor",
    8021: "Dentist", 8099: "Health services",
}

# Stored in the database, so the schema explains itself in the DuckDB CLI or UI.
COMMENTS = {
    "meta": "Facts about this build. `today` is the date the demo treats as now.",
    "customers": "One row per customer.",
    "mcc_labels": "Merchant category code to plain-language label.",
    "transactions": "Every source transaction. Money out is negative.",
    "monthly_baskets": "Every customer x every month. Spending is positive; 0 when nothing happened.",
    "customer_category": "Every customer x spending category over the whole data window.",
    "peer_category": "Per age band x spending category, over customers who spend in it.",
    "transactions.tx_id": "Stable id, ordered by customer, then time, then the balance chain.",
    "transactions.tx_amount_eur": "EUR. Negative = money out.",
    "transactions.balance_after_eur": "Account balance after this transaction. One account per customer.",
    "transactions.label": "Plain name from mcc_code; the category when mcc_code is missing.",
    "transactions.flow": "income | saving | spending",
    "transactions.basket": "regular | irregular | everyday. NULL unless flow = spending.",
    "monthly_baskets.saved_eur": "Net moved to saving: deposits and sweeps minus withdrawals.",
    "customer_category.per_month_eur": "total_eur divided by the months in meta.",
    "peer_category.customers": "Customers in the age band.",
    "peer_category.spenders": "Customers in the age band with any spend in the category; avg and median are over these.",
}


def sql_path(path):
    return "'" + str(path).replace("'", "''") + "'"


def build(con):
    con.execute("create table mcc_labels (mcc_code integer primary key, label varchar not null)")
    con.executemany("insert into mcc_labels values (?, ?)", list(MCC.items()))

    con.execute(f"""
    create table customers as
    select customer_id, customer_postal_code, customer_age,
           case when customer_age < 25 then '18-24' when customer_age < 35 then '25-34'
                when customer_age < 45 then '35-44' when customer_age < 55 then '45-54'
                when customer_age < 65 then '55-64' else '65+' end as age_band
    from read_csv({sql_path(DATA / "tx_customers_junction.csv")}, header = true, columns = {{
        'customer_id': 'VARCHAR', 'customer_postal_code': 'VARCHAR', 'customer_age': 'INTEGER'}})
    order by customer_id
    """)

    con.execute(f"""
    create table transactions as
    with src as (
        select * replace (strptime(tx_timestamp, '%d%b%y:%H:%M:%S') as tx_timestamp)
        from read_csv({sql_path(DATA / "tx_junction_transactions.txt")}, header = true, columns = {{
            'customer_id': 'VARCHAR', 'bank_account_id': 'VARCHAR', 'tx_date': 'DATE',
            'tx_timestamp': 'VARCHAR', 'category': 'VARCHAR', 'tx_amount_eur': 'DECIMAL(12,2)',
            'balance_after_eur': 'DECIMAL(12,2)', 'transaction_type': 'VARCHAR',
            'merchant_id': 'VARCHAR', 'mcc_code': 'INTEGER'}})
    ),
    chained as (
        -- Some pairs of rows share a timestamp to the second. Sort the row that continues
        -- the balance chain second, so the last row of a day holds the closing balance.
        select *, list_contains(
                      list(balance_after_eur) over (partition by customer_id, tx_timestamp),
                      (balance_after_eur - tx_amount_eur)::decimal(12,2)) as continues_chain
        from src
    )
    select
        row_number() over (order by customer_id, tx_timestamp, continues_chain, tx_amount_eur)::integer as tx_id,
        customer_id, bank_account_id, tx_date, tx_timestamp, category, tx_amount_eur,
        balance_after_eur, transaction_type, merchant_id, mcc_code,
        coalesce(l.label, category) as label,
        case
            when category in ('Salary', 'Other Income') then 'income'
            when category in ('Invest Deposit', 'Invest Withdraw', 'Salary Sweep') then 'saving'
            else 'spending' end as flow,
        case
            when category in ('Salary', 'Other Income', 'Invest Deposit', 'Invest Withdraw', 'Salary Sweep') then null
            when category in ('Housing', 'Utilities', 'Groceries') then 'regular'
            when category = 'Transportation' and mcc_code in (4111, 5541, 5542) then 'regular'
            when category = 'Health' then 'irregular'
            when category = 'Home & Tech' and tx_amount_eur <= -{BIG_HOME} then 'irregular'
            else 'everyday' end as basket
    from chained left join mcc_labels l using (mcc_code)
    order by tx_id
    """)

    con.execute("""
    create table meta as
    select * from (values
        ('data_start', (select min(tx_date) from transactions)::varchar),
        ('today', (select max(tx_date) from transactions)::varchar),
        ('months', (select datediff('month', min(tx_date), max(tx_date)) + 1 from transactions)::varchar),
        ('built_at', strftime(now(), '%Y-%m-%d %H:%M:%S')),
        ('duckdb_version', version())
    ) t(key, value)
    """)
    con.execute("insert into meta values ('simulation_revision', '0')")

    con.execute("""
    create table monthly_baskets as
    with months as (
        select unnest(generate_series(date_trunc('month', min(tx_date)), max(tx_date), interval 1 month))::date as month
        from transactions
    ),
    sums as (
        select customer_id, date_trunc('month', tx_date)::date as month,
            -sum(tx_amount_eur) filter (where basket = 'regular')   as regular_eur,
            -sum(tx_amount_eur) filter (where basket = 'irregular') as irregular_eur,
            -sum(tx_amount_eur) filter (where basket = 'everyday')  as everyday_eur,
            sum(tx_amount_eur)  filter (where flow = 'income')      as income_eur,
            -sum(tx_amount_eur) filter (where flow = 'saving')      as saved_eur
        from transactions group by all
    )
    select customer_id, month,
        coalesce(regular_eur, 0)::decimal(12,2)   as regular_eur,
        coalesce(irregular_eur, 0)::decimal(12,2) as irregular_eur,
        coalesce(everyday_eur, 0)::decimal(12,2)  as everyday_eur,
        coalesce(income_eur, 0)::decimal(12,2)    as income_eur,
        coalesce(saved_eur, 0)::decimal(12,2)     as saved_eur
    from (select customer_id, month from customers, months) grid
    left join sums using (customer_id, month)
    order by customer_id, month
    """)

    con.execute("""
    create table customer_category as
    with spend as (
        select customer_id, category, -sum(tx_amount_eur) as total_eur, count(*) as n_tx
        from transactions where flow = 'spending' group by all
    )
    select customer_id, age_band, category,
        coalesce(total_eur, 0)::decimal(12,2) as total_eur,
        round(coalesce(total_eur, 0) / (select value::integer from meta where key = 'months'), 2)::decimal(12,2)
            as per_month_eur,
        coalesce(n_tx, 0)::integer as n_tx
    from customers
    cross join (select distinct category from transactions where flow = 'spending') categories
    left join spend using (customer_id, category)
    order by customer_id, category
    """)

    con.execute("""
    create table peer_category as
    select age_band, category,
        count(*)::integer                         as customers,
        count(*) filter (where n_tx > 0)::integer as spenders,
        -- Compare against people who pay for the category at all, not against zeros.
        round(avg(total_eur) filter (where n_tx > 0) / any_value(m.months), 2)::decimal(12,2)
            as avg_per_month,
        round(median(total_eur::double) filter (where n_tx > 0) / any_value(m.months), 2)::decimal(12,2)
            as median_per_month
    from customer_category, (select value::integer as months from meta where key = 'months') m
    group by age_band, category
    order by age_band, category
    """)

    for target, text in COMMENTS.items():
        kind = "column" if "." in target else "table"
        con.execute(f"comment on {kind} {target} is '{text.replace(chr(39), chr(39) * 2)}'")

    # The six tools (spend_by, safe_to_spend, ...) live in the database as table macros.
    con.execute(TOOLS.read_text())
    con.execute("checkpoint")


def main():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="kori-db-"))
    try:
        # Build outside the project so DuckDB's scratch files never land in it.
        con = duckdb.connect(str(tmp / "kori.duckdb"))
        build(con)
        for (table,) in con.execute("select table_name from duckdb_tables() order by 1").fetchall():
            print(f"{table:18} {con.execute(f'select count(*) from {table}').fetchone()[0]:>10,} rows")
        con.close()

        # Stage next to the target, then rename over it in one step: a process that still has
        # the old file open (a dev server) keeps reading the old file instead of a half-copied one.
        OUT.parent.mkdir(parents=True, exist_ok=True)
        staged = OUT.with_name(OUT.name + ".new")
        shutil.copyfile(tmp / "kori.duckdb", staged)
        # A WAL left by the old file would be replayed into the new one and corrupt it.
        OUT.with_name(OUT.name + ".wal").unlink(missing_ok=True)
        os.replace(staged, OUT)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"built {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.0f} MB)\n")
    ok = check_db.main(OUT)
    ok = test_tools.main(OUT) and ok
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

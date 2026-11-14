-- Kori's six tools: fixed SQL, stored in kori.duckdb as table macros by build_db.py.
-- The app and kori/scripts/test_tools.py call them with bound values, for example
--   select * from spend_by('CUST04414', group_by := 'label', only_label := 'Taxi', period := 'last_month');
-- Every number the model or a card shows comes from here, with the tx_ids behind it.
-- Money out is shown positive. All tools default to the demo's today (meta.today).
--
-- Rule for editing: a macro parameter must never share a name with a column its query can
-- see. DuckDB resolves such a name to the column and the filter silently does nothing.
-- Hence only_* for filters, from_date/to_date for custom periods, and as_of for "today".


-- The date the demo treats as now, unless one is passed in.
create or replace macro kori_today(as_of) as
    coalesce(as_of::date, (select value::date from meta where key = 'today'));


-- A named period as dates. "last_month" is the most recent complete month: on the demo's
-- today, 2026-09-30, a month end, that is September 2026 itself. Whole calendar months
-- count as whole months; any other span counts as days / 30.4375.
create or replace macro period_bounds(period, as_of, from_date, to_date) as table
with d as (
    select kori_today(as_of) as today,
           (select value::date from meta where key = 'data_start') as data_start
),
c as (
    select today, data_start,
           case when today = last_day(today) then date_trunc('month', today)::date
                else (date_trunc('month', today) - interval 1 month)::date end as full_month
    from d
),
b as (
    select
        case period
            when 'this_week'      then date_trunc('week', today)::date
            when 'last_week'      then (date_trunc('week', today) - interval 7 day)::date
            when 'last_30_days'   then today - 29
            when 'this_month'     then date_trunc('month', today)::date
            when 'last_month'     then full_month
            when 'last_3_months'  then (full_month - interval 2 month)::date
            when 'last_6_months'  then (full_month - interval 5 month)::date
            when 'last_12_months' then (full_month - interval 11 month)::date
            when 'this_year'      then date_trunc('year', today)::date
            when 'all'            then data_start
            when 'custom'         then from_date::date
            else error('unknown period: ' || period) end as period_start,
        case period
            when 'last_week'      then (date_trunc('week', today) - interval 1 day)::date
            when 'last_month'     then last_day(full_month)
            when 'last_3_months'  then last_day(full_month)
            when 'last_6_months'  then last_day(full_month)
            when 'last_12_months' then last_day(full_month)
            when 'custom'         then to_date::date
            else today end as period_end
    from c
)
select period_start, period_end,
       datediff('day', period_start, period_end) + 1 as period_days,
       case when day(period_start) = 1 and period_end = last_day(period_end)
            then (datediff('month', period_start, period_end) + 1)::double
            else round((datediff('day', period_start, period_end) + 1) / 30.4375, 2) end as period_months
from b;


-- 1. spend_by: money for one customer in a period, grouped one way.
--    group_by: category | label | basket | merchant | month | weekday | total
--    only_flow: spending (default) | income | saving. Filters: only_category, only_label
--    (plain MCC name such as 'Taxi'), only_basket, only_mcc, only_merchant.
--    Rows: one per group (largest first; months and weekdays in calendar order), then a
--    Total row that is always there, with eur 0 and no ids when nothing matches.
create or replace macro spend_by(customer, group_by := 'category', period := 'all',
                                 from_date := null, to_date := null, only_flow := 'spending',
                                 only_category := null, only_label := null, only_basket := null,
                                 only_mcc := null, only_merchant := null, as_of := null) as table
with p as (select * from period_bounds(period, as_of, from_date, to_date)),
hits as (
    select t.tx_id, t.tx_date,
           case when t.flow = 'income' then t.tx_amount_eur else -t.tx_amount_eur end as eur,
           case group_by
               when 'category' then t.category
               when 'label'    then t.label
               when 'basket'   then coalesce(t.basket, t.flow)
               when 'merchant' then coalesce(t.merchant_id, 'no merchant id')
               when 'month'    then strftime(t.tx_date, '%Y-%m')
               when 'weekday'  then dayname(t.tx_date)
               when 'total'    then 'Total'
               else error('unknown group_by: ' || group_by) end as grp
    from transactions t, p
    where t.customer_id = customer
      and t.flow = only_flow
      and t.tx_date between p.period_start and p.period_end
      and (only_category is null or t.category = only_category)
      and (only_label    is null or t.label = only_label)
      and (only_basket   is null or t.basket = only_basket)
      and (only_mcc      is null or t.mcc_code = only_mcc)
      and (only_merchant is null or t.merchant_id = only_merchant)
),
g as (
    select grp, sum(eur) as eur, count(*)::integer as n, min(isodow(tx_date)) as dow,
           list(tx_id order by tx_id) as tx_ids
    from hits group by grp
),
tot as (
    select coalesce(sum(eur), 0) as eur, count(*)::integer as n,
           coalesce(list(tx_id order by tx_id), []::integer[]) as tx_ids
    from hits
),
rows_ as (
    select g.grp as key, g.eur, g.n,
           round(g.eur / p.period_months, 2) as per_month_eur,
           round(100 * g.eur / nullif(tot.eur, 0), 1) as share_pct,
           false as is_total,
           row_number() over (order by case when group_by = 'month' then g.grp end,
                                       case when group_by = 'weekday' then g.dow end,
                                       g.eur desc) as sort_order,
           g.tx_ids
    from g, tot, p
    where group_by <> 'total'
    union all
    select 'Total', tot.eur, tot.n, round(tot.eur / p.period_months, 2), 100.0, true, 1000000, tot.tx_ids
    from tot, p
)
select r.key, r.eur::decimal(12,2) as eur, r.n, r.per_month_eur, r.share_pct, r.is_total,
       strftime(p.period_start, '%Y-%m-%d') as period_start,
       strftime(p.period_end, '%Y-%m-%d') as period_end,
       p.period_months, r.tx_ids
from rows_ r, p
order by r.sort_order;


-- 2. safe_to_spend: the weekly number, as lines the "How I calculated this" sheet can show.
--      balance - basket-one payments due before payday - irregular buffer - savings goal,
--      divided by days to payday, times seven.
--    Basket one: a payment made about once a month on a steady day (rent) counts in full when
--    its next due date falls before payday. Other basket-one spending (groceries, utilities,
--    commuting, fuel) is reserved at the customer's own pace over the last 6 months.
--    Irregular buffer: the 12-month average of basket two, for the days left to payday.
--    savings_goal: euros to keep aside before payday. Default 2000: the demo keeps a €2,000
--    cushion, so the weekly number reads as a budget, not as permission to drain the account.
--    Lines (key): balance, bill (one per category), buffer, goal, available, weekly, and two
--    info lines that are not part of the sum: salary, irregular_avg.
create or replace macro safe_to_spend(customer, savings_goal := 2000, as_of := null) as table
with d as (select kori_today(as_of) as today),
mine as (
    select t.* from transactions t, d where t.customer_id = customer and t.tx_date <= d.today
),
bal as (select tx_id, tx_date, balance_after_eur as eur from mine order by tx_id desc limit 1),
sal as (select tx_id, tx_date, tx_amount_eur from mine where category = 'Salary' order by tx_id desc limit 6),
pay as (
    -- (a DECIMAL(12,2) median would cut 624.655 to 624.65; widen first, then round to cents)
    select mode(day(tx_date)) as pay_day, round(median(tx_amount_eur::decimal(14,4)), 2) as salary_eur,
           coalesce(list(tx_id order by tx_id), []::integer[]) as salary_ids
    from sal
),
pd0 as (
    select d.today, pay.pay_day, pay.salary_eur, pay.salary_ids,
        case
            when pay.pay_day is null then last_day(d.today) + 1
            when make_date(year(d.today), month(d.today), least(pay.pay_day, day(last_day(d.today)))) > d.today
                then make_date(year(d.today), month(d.today), least(pay.pay_day, day(last_day(d.today))))
            else make_date(year(last_day(d.today) + 1), month(last_day(d.today) + 1),
                           least(pay.pay_day, day(last_day(last_day(d.today) + 1))))
        end as payday
    from d, pay
),
pd as (select *, datediff('day', today, payday)::integer as days from pd0),
win as (
    select (d.today - interval 6 month)::date as since,
           datediff('day', (d.today - interval 6 month)::date, d.today)::integer as window_days
    from d
),
reg as (
    select m.category, count(*) as n_pay, median(day(m.tx_date)) as typical_day,
           max(day(m.tx_date)) - min(day(m.tx_date)) as day_spread, max(m.tx_date) as last_paid,
           round(median(-m.tx_amount_eur::decimal(14,4)), 2) as typical_eur, sum(-m.tx_amount_eur) as eur_6m,
           list(m.tx_id order by m.tx_id) as tx_ids
    from mine m, win
    where m.basket = 'regular' and m.tx_date > win.since
    group by m.category
),
bills as (
    select r.category, r.tx_ids,
           (r.n_pay between 5 and 7 and r.day_spread <= 10) as is_monthly,
           -- a monthly payment's next due date: its usual day, in the month after the last one
           make_date(year(last_day(r.last_paid) + 1), month(last_day(r.last_paid) + 1),
                     least(round(r.typical_day)::integer, day(last_day(last_day(r.last_paid) + 1)))) as next_due,
           r.typical_eur, r.eur_6m
    from reg r
),
bill_lines as (
    select b.*,
           case when b.is_monthly and b.next_due < pd.payday then b.typical_eur
                when b.is_monthly then 0
                else round(b.eur_6m / win.window_days * pd.days, 2) end::decimal(12,2) as due_eur
    from bills b, pd, win
),
last12 as (select * from period_bounds('last_12_months', as_of, null, null)),
buf as (
    select round(avg(mb.irregular_eur), 2)::decimal(12,2) as monthly_eur,
           round(avg(mb.irregular_eur) * any_value(pd.days) / 30.4375, 2)::decimal(12,2) as due_eur
    from monthly_baskets mb, last12, pd
    where mb.customer_id = customer and mb.month between last12.period_start and last12.period_end
),
irr as (
    select coalesce(list(m.tx_id order by m.tx_id), []::integer[]) as tx_ids
    from mine m, last12
    where m.basket = 'irregular' and m.tx_date between last12.period_start and last12.period_end
),
res as (
    select bal.eur as balance,
           coalesce((select sum(due_eur) from bill_lines), 0)::decimal(12,2) as bills,
           buf.due_eur as buffer,
           savings_goal::decimal(12,2) as goal,
           (bal.eur - coalesce((select sum(due_eur) from bill_lines), 0) - buf.due_eur
                - savings_goal::decimal(12,2))::decimal(12,2) as available,
           pd.days
    from bal, buf, pd
),
lines as (
    select 1 as line, 'balance' as key, 'start' as kind, 'Balance now' as label, res.balance as eur,
           'after your last transaction, ' || strftime(bal.tx_date, '%-d %b') as note, [bal.tx_id] as tx_ids
    from res, bal
    union all
    select 10 + row_number() over (order by bl.due_eur desc), 'bill', 'minus',
           case when bl.is_monthly then bl.category || ' due ' || strftime(bl.next_due, '%-d %b')
                else bl.category || ' until payday' end,
           -bl.due_eur,
           case when bl.is_monthly then 'your usual amount: median of the last 6 payments'
                else format('your own pace over the last 6 months, for {} days', pd.days) end,
           bl.tx_ids
    from bill_lines bl, pd
    where bl.due_eur > 0
    union all
    select 50, 'buffer', 'minus', 'Irregular buffer', -buf.due_eur,
           format('basket two averages €{:,.2f} a month; this is {} days of it', buf.monthly_eur::double, pd.days),
           irr.tx_ids
    from buf, pd, irr
    union all
    select 60, 'goal', 'minus', 'Savings goal', -res.goal, 'kept aside before payday', []::integer[]
    from res where res.goal > 0
    union all
    select 70, 'available', 'result', 'Left until payday', res.available,
           'balance minus everything above', []::integer[]
    from res
    union all
    select 80, 'weekly', 'result', 'Safe to spend this week',
           greatest(round(res.available / res.days * 7, 2), 0)::decimal(12,2),
           format('€{:,.2f} ÷ {} days × 7', res.available::double, res.days), []::integer[]
    from res
    union all
    select 90, 'salary', 'info', 'Next salary', pd.salary_eur::decimal(12,2),
           format('expected {}: median of the last 6 salaries', strftime(pd.payday, '%-d %b')),
           pd.salary_ids
    from pd
    union all
    select 91, 'irregular_avg', 'info', 'Basket two, monthly average', buf.monthly_eur,
           'irregular costs over the last 12 months, per month', irr.tx_ids
    from buf, irr
)
select l.line::integer as line, l.key, l.kind, l.label, l.eur::decimal(12,2) as eur, l.note,
       strftime(pd.today, '%Y-%m-%d') as today, strftime(pd.payday, '%Y-%m-%d') as payday,
       pd.days as days_to_payday, l.tx_ids
from lines l, pd
order by l.line;


-- 3. simulate_cut: cutting one category, label or basket by a percentage.
--    One row. The *_steps lists hold the slider's values for 0, 5, ..., 100 %; the scalar
--    columns hold the values at pct (default 20). The base is the per-month average over
--    period (default all data, the same base spend_by shows). weekly_* columns set the
--    category's usual weekly spend beside the weekly safe-to-spend.
create or replace macro simulate_cut(customer, only_category := null, only_label := null,
                                     only_basket := null, pct := 20, period := 'all',
                                     savings_goal := 2000, as_of := null) as table
with base as (
    select per_month_eur, eur, n, period_months, period_start, period_end, tx_ids
    from spend_by(customer, group_by := 'total', period := period, only_category := only_category,
                  only_label := only_label, only_basket := only_basket, as_of := as_of)
),
sts as (select eur from safe_to_spend(customer, savings_goal := savings_goal, as_of := as_of) where key = 'weekly'),
calc as (
    select s.cut_pct,
           round(b.per_month_eur * s.cut_pct / 100, 2) as monthly_saving,
           round(b.per_month_eur * s.cut_pct / 100 * 12, 2) as yearly_saving,
           round(b.per_month_eur * s.cut_pct / 100 * 12 / 52, 2) as weekly_saving,
           round(b.per_month_eur * (100 - s.cut_pct) / 100, 2) as monthly_after,
           round(b.per_month_eur * (100 - s.cut_pct) / 100 * 12 / 52, 2) as weekly_after
    from base b, (select unnest(range(0, 101, 5)::integer[]) as cut_pct
                  union select pct::integer) s
)
select pct::integer as cut_pct,
       b.per_month_eur as monthly_now,
       c.monthly_after, c.monthly_saving, c.yearly_saving,
       round(b.per_month_eur * 12 / 52, 2) as weekly_now,
       c.weekly_after, c.weekly_saving,
       sts.eur as safe_to_spend_week,
       b.n as purchases, b.period_start, b.period_end,
       (select list(cut_pct order by cut_pct) from calc where cut_pct % 5 = 0) as pct_steps,
       (select list(monthly_saving order by cut_pct) from calc where cut_pct % 5 = 0) as monthly_saving_steps,
       (select list(yearly_saving order by cut_pct) from calc where cut_pct % 5 = 0) as yearly_saving_steps,
       (select list(weekly_after order by cut_pct) from calc where cut_pct % 5 = 0) as weekly_after_steps,
       b.tx_ids
from base b, sts, calc c
where c.cut_pct = pct::integer;


-- 4. benchmark: the customer's monthly spend per category beside people in the same age band
--    who spend in that category (24 months of data). percentile = share of those peers who
--    spend less than the customer. Rows sorted by times_peer_avg, highest first.
create or replace macro benchmark(customer, only_category := null) as table
with me as (select cc.* from customer_category cc where cc.customer_id = customer),
ranked as (
    select cc.customer_id, cc.category,
           percent_rank() over (partition by cc.category order by cc.total_eur) as pr
    from customer_category cc
    where cc.n_tx > 0
      and cc.age_band = (select c.age_band from customers c where c.customer_id = customer)
),
mine_ids as (
    select t.category, list(t.tx_id order by t.tx_id) as tx_ids
    from transactions t where t.customer_id = customer and t.flow = 'spending'
    group by t.category
)
select me.category, me.age_band, me.per_month_eur as you_per_month, me.n_tx as your_purchases,
       pc.avg_per_month as peers_avg_per_month, pc.median_per_month as peers_median_per_month,
       pc.spenders as peers_counted, pc.customers as peers_in_band,
       round(me.per_month_eur / nullif(pc.avg_per_month, 0), 1) as times_peer_avg,
       round(100 * r.pr)::integer as percentile,
       coalesce(mine_ids.tx_ids, []::integer[]) as tx_ids
from me
join peer_category pc on pc.age_band = me.age_band and pc.category = me.category
left join ranked r on r.customer_id = me.customer_id and r.category = me.category
left join mine_ids on mine_ids.category = me.category
where only_category is null or me.category = only_category
order by times_peer_avg desc nulls last, me.category;


-- 5. spender_profile: a persona from basket shares and timing, three evidence lines and one
--    habit to try this week. Rules, first match wins, on everyday-basket spending in period:
--      Night-out spender  restaurants + entertainment >= 50 % of everyday
--      Shopper            lifestyle + everyday home & tech >= 40 %
--      Traveller          travel >= 30 %
--      Steady saver       saves >= 15 % of income and everyday <= 25 % of all spending
--      Balanced spender   otherwise
--    Rows: kind persona | evidence | habit, with a key, a title, card text, one value, tx_ids.
create or replace macro spender_profile(customer, period := 'all', as_of := null) as table
with p as (select * from period_bounds(period, as_of, null, null)),
hits as (
    select t.* from transactions t, p
    where t.customer_id = customer and t.tx_date between p.period_start and p.period_end
),
f as (
    select
        coalesce(sum(-tx_amount_eur) filter (where flow = 'spending'), 0) as spending,
        coalesce(sum(-tx_amount_eur) filter (where basket = 'everyday'), 0) as everyday,
        coalesce(sum(-tx_amount_eur) filter (where basket = 'everyday' and category in ('Restaurants', 'Entertainment')), 0) as going_out,
        coalesce(sum(-tx_amount_eur) filter (where basket = 'everyday' and category in ('Lifestyle', 'Home & Tech')), 0) as shopping,
        coalesce(sum(-tx_amount_eur) filter (where basket = 'everyday' and category = 'Travel'), 0) as travel,
        coalesce(sum(tx_amount_eur) filter (where flow = 'income'), 0) as income,
        coalesce(sum(-tx_amount_eur) filter (where flow = 'saving'), 0) as saved,
        coalesce(sum(-tx_amount_eur) filter (where basket = 'everyday' and hour(tx_timestamp) >= 18), 0) as evening,
        coalesce(sum(-tx_amount_eur) filter (where basket = 'everyday' and isodow(tx_date) >= 6), 0) as weekend,
        coalesce(list(tx_id order by tx_id) filter (where basket = 'everyday'), []::integer[]) as everyday_ids,
        coalesce(list(tx_id order by tx_id) filter (where basket = 'everyday' and category in ('Restaurants', 'Entertainment')), []::integer[]) as going_out_ids,
        coalesce(list(tx_id order by tx_id) filter (where basket = 'everyday' and category in ('Lifestyle', 'Home & Tech')), []::integer[]) as shopping_ids,
        coalesce(list(tx_id order by tx_id) filter (where basket = 'everyday' and category = 'Travel'), []::integer[]) as travel_ids,
        coalesce(list(tx_id order by tx_id) filter (where flow = 'saving'), []::integer[]) as saving_ids,
        coalesce(list(tx_id order by tx_id) filter (where basket = 'everyday' and hour(tx_timestamp) >= 18), []::integer[]) as evening_ids,
        coalesce(list(tx_id order by tx_id) filter (where basket = 'everyday' and isodow(tx_date) >= 6), []::integer[]) as weekend_ids
    from hits
),
s as (
    select f.*, p.period_months as months, p.period_days as days,
           100 * going_out / nullif(everyday, 0) as going_out_pct,
           100 * shopping / nullif(everyday, 0) as shopping_pct,
           100 * travel / nullif(everyday, 0) as travel_pct,
           100 * everyday / nullif(spending, 0) as everyday_pct,
           100 * saved / nullif(income, 0) as saving_pct,
           100 * evening / nullif(everyday, 0) as evening_pct,
           100 * weekend / nullif(everyday, 0) as weekend_pct
    from f, p
),
persona as (
    select case
               when going_out_pct >= 50 then 'Night-out spender'
               when shopping_pct >= 40 then 'Shopper'
               when travel_pct >= 30 then 'Traveller'
               when saving_pct >= 15 and everyday_pct <= 25 then 'Steady saver'
               else 'Balanced spender' end as name
    from s
),
top as (
    select h.category, sum(-h.tx_amount_eur) as eur, count(*) as n, list(h.tx_id order by h.tx_id) as tx_ids
    from hits h where h.basket = 'everyday'
    group by h.category order by eur desc, h.category limit 1
),
peer as (
    select cc.per_month_eur as you, pc.avg_per_month as peers, pc.age_band
    from customer_category cc
    join peer_category pc on pc.age_band = cc.age_band and pc.category = cc.category
    where cc.customer_id = customer and cc.category = (select category from top)
),
lines as (
    select 1 as line, 'persona' as kind, 'persona' as key, persona.name as title,
           case persona.name
               when 'Night-out spender' then 'Most of your everyday money goes on going out: restaurants and entertainment.'
               when 'Shopper' then 'Clothes, gadgets and things for home are your biggest everyday spend.'
               when 'Traveller' then 'Trips take the largest share of your everyday spending.'
               when 'Steady saver' then 'You save a good share of your income and keep everyday spending low.'
               else 'Your everyday spending is spread out; no single habit dominates.' end as text,
           round(s.everyday / s.months, 2) as value, s.everyday_ids as tx_ids
    from persona, s
    union all
    select 2, 'evidence', 'driver',
           case persona.name when 'Night-out spender' then 'Going out'
                             when 'Shopper' then 'Shopping'
                             when 'Traveller' then 'Travel'
                             when 'Steady saver' then 'Saving'
                             else 'Everyday spending' end,
           case persona.name
               when 'Night-out spender' then format('Restaurants and entertainment: €{:,.0f} a month, {:.0f}% of your everyday spending.', s.going_out / s.months, s.going_out_pct)
               when 'Shopper' then format('Lifestyle and home & tech: €{:,.0f} a month, {:.0f}% of your everyday spending.', s.shopping / s.months, s.shopping_pct)
               when 'Traveller' then format('Travel: €{:,.0f} a month, {:.0f}% of your everyday spending.', s.travel / s.months, s.travel_pct)
               when 'Steady saver' then format('You move {:.0f}% of your income to saving: €{:,.0f} a month.', s.saving_pct, s.saved / s.months)
               else format('Everyday spending: €{:,.0f} a month, {:.0f}% of all your spending.', s.everyday / s.months, s.everyday_pct) end,
           round(case persona.name when 'Night-out spender' then s.going_out
                                   when 'Shopper' then s.shopping
                                   when 'Traveller' then s.travel
                                   when 'Steady saver' then s.saved
                                   else s.everyday end / s.months, 2),
           case persona.name when 'Night-out spender' then s.going_out_ids
                             when 'Shopper' then s.shopping_ids
                             when 'Traveller' then s.travel_ids
                             when 'Steady saver' then s.saving_ids
                             else s.everyday_ids end
    from persona, s
    union all
    select 3, 'evidence', 'vs_peers', 'Compared with people your age',
           format('{}: €{:,.0f} a month, {:.1f}× the average for ages {} (€{:,.0f}).',
                  top.category, peer.you::double, peer.you / nullif(peer.peers, 0), peer.age_band, peer.peers::double),
           round(peer.you / nullif(peer.peers, 0), 1), top.tx_ids
    from top, peer
    union all
    select 4, 'evidence', case when s.evening_pct >= s.weekend_pct then 'evening' else 'weekend' end,
           'When you spend',
           case when s.evening_pct >= s.weekend_pct
                then format('{:.0f}% of your everyday spending happens after 6 pm.', s.evening_pct)
                else format('{:.0f}% of your everyday spending happens at weekends.', s.weekend_pct) end,
           round(greatest(s.evening_pct, s.weekend_pct), 1),
           case when s.evening_pct >= s.weekend_pct then s.evening_ids else s.weekend_ids end
    from s
    where s.everyday > 0
    union all
    select 5, 'habit', 'skip_one', 'Try this week',
           format('Skip one {} this week: you average {:.1f} a week at €{:,.0f} each. One fewer every week keeps about €{:,.0f} a month.',
                  case top.category when 'Restaurants' then 'restaurant visit'
                                    when 'Entertainment' then 'night out'
                                    when 'Lifestyle' then 'shopping trip'
                                    when 'Transportation' then 'taxi or parking'
                                    when 'Travel' then 'trip booking'
                                    else 'everyday purchase' end,
                  top.n / (s.days / 7), top.eur / top.n, top.eur / top.n * 52 / 12),
           round(top.eur / top.n, 2), top.tx_ids
    from top, s
)
select line, kind, key, title, text, value, tx_ids from lines order by line;


-- 6. list_transactions: the rows behind any number, for the transaction-list card and the
--    "How I calculated this" sheet. These rows go to the screen, never to the model.
--    Pass ids (from another tool's tx_ids) or filters. Always limited to this customer.
--    sort: newest (default) | oldest | largest. max_rows applies to filters, not to ids.
create or replace macro list_transactions(customer, ids := null, period := 'all',
                                          from_date := null, to_date := null, only_flow := null,
                                          only_category := null, only_label := null, only_basket := null,
                                          only_mcc := null, only_merchant := null,
                                          sort := 'newest', max_rows := 50, as_of := null) as table
with p as (select * from period_bounds(period, as_of, from_date, to_date))
select t.tx_id, strftime(t.tx_date, '%Y-%m-%d') as "date", strftime(t.tx_timestamp, '%H:%M') as "time",
       dayname(t.tx_date) as weekday, t.label, t.category, t.basket, t.flow,
       t.tx_amount_eur as amount_eur, t.balance_after_eur, t.merchant_id, t.mcc_code
from transactions t, p
where t.customer_id = customer
  and case when ids is not null then list_contains(ids::integer[], t.tx_id)
           else t.tx_date between p.period_start and p.period_end
                and (only_flow     is null or t.flow = only_flow)
                and (only_category is null or t.category = only_category)
                and (only_label    is null or t.label = only_label)
                and (only_basket   is null or t.basket = only_basket)
                and (only_mcc      is null or t.mcc_code = only_mcc)
                and (only_merchant is null or t.merchant_id = only_merchant) end
order by case when sort = 'largest' then abs(t.tx_amount_eur) end desc nulls last,
         case when sort = 'oldest' then t.tx_id end asc nulls last,
         t.tx_id desc
limit case when ids is not null then 100000 else max_rows::integer end;

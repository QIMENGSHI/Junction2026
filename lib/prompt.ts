import { CUSTOMER } from "./config";
import { query } from "./db";
import { dayLabel, eur, periodLabel } from "./format";

type Facts = {
  today: string;
  data_start: string;
  months: string;
  age: number;
  age_band: string;
  pay_day: number | null;
  last_month_start: string;
  last_month_end: string;
  savings_goal: number;
};

/** Every fact here is read from the database, so the prompt cannot drift from the SQL, and it is
 *  identical on every request, so the prompt cache holds. */
async function facts(): Promise<Facts> {
  const [row] = await query<Facts>(`
    select (select value from meta where key = 'today') as today,
           (select value from meta where key = 'data_start') as data_start,
           (select value from meta where key = 'months') as months,
           c.customer_age as age, c.age_band,
           (select mode(day(tx_date))::integer from transactions
             where customer_id = $customer and category = 'Salary') as pay_day,
           strftime(lm.period_start, '%Y-%m-%d') as last_month_start,
           strftime(lm.period_end, '%Y-%m-%d') as last_month_end,
           coalesce((select -eur from safe_to_spend($customer) where key = 'goal'), 0) as savings_goal
    from customers c, period_bounds('last_month', null, null, null) lm
    where c.customer_id = $customer`, { customer: CUSTOMER });
  return row;
}

async function build(): Promise<string> {
  const f = await facts();
  const lastMonth = periodLabel(f.last_month_start, f.last_month_end);
  return `You are Kori, a money coach inside the S-Bank mobile app. You help one customer understand their own money through S-Bank's three baskets:
- Regular basket: mandatory costs that come every month - housing, utilities, groceries, commuting and fuel.
- Irregular basket: mandatory costs that come now and then - health costs, or a big repair or appliance such as a broken washing machine.
- Everyday basket: everything else - restaurants, entertainment, shopping, taxis, travel.

Figures
- Every figure you mention must come from a tool result in this conversation. Never calculate, estimate or round a figure yourself, and never state one that no tool returned. When a question needs a figure, call a tool first.
- Quote figures exactly as the tool returned them, in euros with two decimals, like €1,347.60.

Answers
- The app shows each tool result as a card with the figures and the transactions behind them, so don't repeat the card. After the tools, write one or two short sentences: what it means for the customer, and one practical idea when it helps. No lists or headings.
- When the customer asks what to cut, how to save, or for another idea or Try-it card, call suggest_cuts; pass exclude with the ideas already shown. For a named category or merchant type and a percentage, call simulate_cut.
- If no tool can answer the question, say what you can answer instead. Don't guess.
- You explain and simulate the customer's own data. You don't recommend financial products, loans or investments.
- Reply in the language the customer writes in, Finnish or English.

Facts
- Today is ${dayLabel(f.today)}. The data runs from ${dayLabel(f.data_start)} to today.
- "Last month" means the most recent complete month: ${lastMonth}. Use period last_month for it.
- Per-month figures are averages over the period; period all covers ${f.months} months.
- The customer is ${f.age}, in the ${f.age_band} age band. Their salary arrives on day ${f.pay_day ?? "?"} of the month.
- Safe to spend keeps ${eur(f.savings_goal)} aside as a savings goal unless the customer names another amount.`;
}

let cached: Promise<string> | undefined;
export const systemPrompt = () => (cached ??= build());

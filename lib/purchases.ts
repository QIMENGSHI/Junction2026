import { z } from "zod";
import type { DuckDBConnection } from "@duckdb/node-api";
import { CUSTOMER } from "./config";
import { connect, dbMode, query } from "./db";
import { PURCHASE_PRESETS, type PurchaseState, type PurchaseSummary } from "./purchase-presets";

export const purchaseInput = z.object({
  preset: z.enum(["dinner", "taxi", "groceries", "dentist"]),
  amount_eur: z.number().min(1).max(5000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7, "Use at most two decimals.").optional(),
}).strict();

export class PurchaseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function listPurchases(): Promise<PurchaseState> {
  const mode = await dbMode();
  if (mode === "local") return { enabled: false, purchases: [], version: "local" };
  const [state] = await query<{ purchases: PurchaseSummary[]; revision: string; total: string }>(`
    select coalesce(list(struct_pack(tx_id := tx_id, label := label, amount_eur := -tx_amount_eur,
      date := strftime(tx_date, '%Y-%m-%d')) order by tx_id desc), []) as purchases,
      coalesce((select value from meta where key='simulation_revision'), '0') as revision,
      coalesce(sum(tx_amount_eur), 0)::varchar as total
    from transactions where customer_id=$customer and merchant_id='SIMULATED'`, { customer: CUSTOMER });
  // Monotonic revision also detects reset + a new insert between two polls (ids can be reused).
  return { enabled: mode === "motherduck", purchases: state.purchases,
    version: `${mode}:${state.revision}:${state.purchases.length}:${state.purchases[0]?.tx_id ?? 0}:${state.total}` };
}

// Serialize within a process; the meta-row update gives remote transactions a write conflict
// across Vercel instances too, protecting max(tx_id)+1, the cap and the balance anchor.
let pending: Promise<unknown> = Promise.resolve();
async function write(action: (connection: DuckDBConnection) => Promise<void>) {
  const run = pending.then(async () => {
    if (await dbMode() === "local") throw new PurchaseError("Live purchases are unavailable in offline mode.", 503);
    for (let attempt = 0; attempt < 3; attempt++) {
      const connection = await connect();
      try {
        await connection.run("begin transaction");
        const revision = await connection.runAndReadAll(`update meta set value = (value::bigint + 1)::varchar
          where key = 'simulation_revision' returning value`);
        if (!revision.getRowObjectsJS().length) throw new PurchaseError("Run the MotherDuck upload/migration script first.", 503);
        await action(connection);
        await connection.run("commit");
        return;
      } catch (error) {
        await connection.run("rollback").catch(() => undefined);
        if (attempt < 2 && error instanceof Error && /conflict|transaction.*abort/i.test(error.message)) continue;
        throw error;
      } finally { connection.closeSync(); }
    }
  });
  pending = run.catch(() => undefined);
  await run;
  return listPurchases();
}

export async function addPurchase(input: unknown) {
  const parsed = purchaseInput.safeParse(input);
  if (!parsed.success) throw new PurchaseError("Choose a purchase and an amount from €1 to €5,000, with at most two decimals.");
  const preset = PURCHASE_PRESETS[parsed.data.preset];
  return write(async (connection) => {
    const reader = await connection.runAndReadAll(`
      insert into transactions
      with anchor as (
        select * from transactions where customer_id = $customer
          and tx_date <= (select value::date from meta where key = 'today') order by tx_id desc limit 1
      ), p as (select $category::varchar as category, $mcc::integer as mcc, $amount::decimal(12,2) as amount)
      select (select max(tx_id) + 1 from transactions)::integer,
             a.customer_id, a.bank_account_id,
             (select value::date from meta where key = 'today'),
             -- Keep simulated time on the demo date, even if the anchor is near midnight.
             least(greatest(a.tx_timestamp, (select value::date from meta where key = 'today')::timestamp)
               + interval 1 minute, (select value::date from meta where key = 'today')::timestamp + interval '23:59:59'),
             p.category, -p.amount, (a.balance_after_eur - p.amount)::decimal(12,2),
             'purchase', 'SIMULATED', p.mcc, l.label, 'spending',
             case when p.category in ('Housing', 'Utilities', 'Groceries') then 'regular'
                  when p.category = 'Transportation' and p.mcc in (4111,5541,5542) then 'regular'
                  when p.category = 'Health' then 'irregular'
                  when p.category = 'Home & Tech' and p.amount >= 400 then 'irregular'
                  else 'everyday' end
      from anchor a, p, mcc_labels l where l.mcc_code = p.mcc
        and (select count(*) from transactions where customer_id = $customer and merchant_id = 'SIMULATED') < 20
      returning tx_id`, {
      customer: CUSTOMER, category: preset.category, mcc: preset.mcc,
      amount: (parsed.data.amount_eur ?? preset.amount).toFixed(2),
    });
    if (!reader.getRowObjectsJS().length) throw new PurchaseError("The demo limit is 20 purchases. Reset before adding more.", 409);
  });
}

export function resetPurchases() {
  return write(async (connection) => {
    await connection.run("delete from transactions where customer_id = $customer and merchant_id = 'SIMULATED'", { customer: CUSTOMER });
  });
}

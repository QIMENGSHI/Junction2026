// Run locally first. The same checks must also be exercised in the Vercel Node runtime.
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) loadEnvFile(".env.local");
async function main() {
  if (!process.env.MOTHERDUCK_TOKEN) throw new Error("Missing MOTHERDUCK_TOKEN");
  const started = performance.now();
  const { dbMode, query } = await import("../lib/db");
  if (await dbMode() !== "motherduck") throw new Error("MotherDuck initialization failed; fallback is active");
  const connected = performance.now();
  const counts = await query<{ n: number }>("select count(*)::integer as n from transactions");
  const countDone = performance.now();
  const weekly = await query<{ eur: number }>("select eur from safe_to_spend($customer) where key = 'weekly'", { customer: process.env.KORI_CUSTOMER ?? "CUST04414" });
  console.log({ mode: "motherduck", initializationMs: Math.round(connected - started), countQueryMs: Math.round(countDone - connected),
    budgetQueryMs: Math.round(performance.now() - countDone), rows: counts[0].n, weekly: weekly[0].eur });
}
main().then(() => process.exit(0)).catch(() => { console.error("MotherDuck spike failed. Verify token, uploaded database, extension support and runtime. No credentials are printed."); process.exit(1); });

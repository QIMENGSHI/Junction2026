import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) loadEnvFile(".env.local");
async function main() {
  if (!process.env.MOTHERDUCK_TOKEN) throw new Error("Set MOTHERDUCK_TOKEN in .env.local first.");
  const { dbMode } = await import("../lib/db");
  if (await dbMode() !== "motherduck") throw new Error("MotherDuck is unavailable. No data changed.");
  const { addPurchase, listPurchases, resetPurchases } = await import("../lib/purchases");
  const [command, amount] = process.argv.slice(2);
  if (!command || !["dinner", "taxi", "groceries", "dentist", "reset", "list"].includes(command)) {
    throw new Error("Usage: npm run purchase -- dinner|taxi|groceries|dentist [euros], or reset|list");
  }
  const state = command === "reset" ? await resetPurchases()
    : command === "list" ? await listPurchases()
    : await addPurchase({ preset: command, ...(amount !== undefined ? { amount_eur: Number(amount) } : {}) });
  console.table(state.purchases);
  const { executeTool } = await import("../lib/tools");
  const result = await executeTool("safe_to_spend", {});
  if (!result.ok || result.card.kind !== "safe_to_spend") throw new Error("Couldn’t recalculate the budget.");
  console.log("Safe to spend this week:", result.card.lines.find((line) => line.key === "weekly")?.eur);
}
main().then(() => process.exit(0)).catch(() => { console.error("Purchase command failed. Check the command, cloud connection, and upload/migration step. No token is printed."); process.exit(1); });

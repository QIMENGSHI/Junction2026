import { Home } from "@/components/home";
import type { BarsCard, CutCard, SafeCard } from "@/lib/protocol";
import { executeTool } from "@/lib/tools";
import { listPurchases } from "@/lib/purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function homeCard<T extends SafeCard | BarsCard | CutCard>(name: string, input: Record<string, unknown>, kind: T["kind"]): Promise<T> {
  const outcome = await executeTool(name, input);
  if (!outcome.ok) throw new Error(outcome.error);
  if (outcome.card.kind !== kind) throw new Error(`${name} returned ${outcome.card.kind}, expected ${kind}`);
  return outcome.card as T;
}

export default async function Page() {
  const [safe, baskets, cut, simulation] = await Promise.all([
    homeCard<SafeCard>("safe_to_spend", {}, "safe_to_spend"),
    homeCard<BarsCard>("spend_by", { group_by: "basket", period: "this_month" }, "bars"),
    homeCard<CutCard>("simulate_cut", { category: "Restaurants", pct: 20, period: "this_month" }, "cut"),
    listPurchases(),
  ]);
  return <Home safe={safe} baskets={baskets} cut={cut} simulation={simulation} />;
}

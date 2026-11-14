import { Home } from "@/components/home";
import { BASKETS } from "@/lib/category-colors";
import type { BarsCard, IdeasCard, SafeCard } from "@/lib/protocol";
import { executeTool } from "@/lib/tools";
import { listPurchases } from "@/lib/purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function homeCard<T extends SafeCard | BarsCard | IdeasCard>(name: string, input: Record<string, unknown>, kind: T["kind"]): Promise<T> {
  const outcome = await executeTool(name, input);
  if (!outcome.ok) throw new Error(outcome.error);
  if (outcome.card.kind !== kind) throw new Error(`${name} returned ${outcome.card.kind}, expected ${kind}`);
  return outcome.card as T;
}

export default async function Page() {
  // The back of the baskets card: each basket split by category, same tool and period as the front.
  const splits = Promise.all(BASKETS.map((basket) =>
    homeCard<BarsCard>("spend_by", { group_by: "category", basket, period: "this_month" }, "bars")));
  const [safe, baskets, ideas, simulation, breakdowns] = await Promise.all([
    homeCard<SafeCard>("safe_to_spend", {}, "safe_to_spend"),
    homeCard<BarsCard>("spend_by", { group_by: "basket", period: "this_month" }, "bars"),
    // The Try-it stack: the customer's everyday spending furthest above normal, ranked by SQL.
    homeCard<IdeasCard>("suggest_cuts", {}, "ideas"),
    listPurchases(),
    splits.then((cards) => Object.fromEntries(BASKETS.map((basket, i) => [basket, cards[i]])) as Record<(typeof BASKETS)[number], BarsCard>),
  ]);
  return <Home safe={safe} baskets={baskets} breakdowns={breakdowns} ideas={ideas} simulation={simulation} />;
}

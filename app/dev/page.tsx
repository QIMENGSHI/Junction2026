import { CardView } from "@/components/cards/card-view";
import { executeTool } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Each demo question with the tool call the model is expected to make for it.
const DEMO: Array<{ question: string; tool: string; input: Record<string, unknown> }> = [
  { question: "How much can I spend this week?", tool: "safe_to_spend", input: {} },
  { question: "How much did I spend on taxis last month?", tool: "spend_by", input: { group_by: "total", label: "Taxi", period: "last_month" } },
  { question: "Where does my money really go?", tool: "spend_by", input: { group_by: "basket", period: "all" } },
  { question: "… and inside the everyday basket?", tool: "spend_by", input: { group_by: "category", basket: "everyday", period: "all" } },
  { question: "Restaurants, month by month", tool: "spend_by", input: { group_by: "month", category: "Restaurants", period: "all" } },
  { question: "What if I cut dining out by 20%?", tool: "simulate_cut", input: { category: "Restaurants", pct: 20 } },
  { question: "Is that normal for my age?", tool: "benchmark", input: { category: "Restaurants" } },
  { question: "What kind of spender am I?", tool: "spender_profile", input: {} },
  { question: "Show me last month's taxi rides", tool: "list_transactions", input: { label: "Taxi", period: "last_month" } },
];

/** Every card from the real tools, without the model, and exactly what the model is sent. */
export default async function CardGallery() {
  const results = await Promise.all(DEMO.map(async (demo) => ({ ...demo, outcome: await executeTool(demo.tool, demo.input) })));
  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold">Card gallery</h1>
        <p className="mt-1 text-sm text-ink-2">
          Each demo question&apos;s card, straight from the SQL tools. Under each card: everything the model is sent
          for it - figures and labels, never ids or transaction rows.
        </p>
      </header>
      {results.map(({ question, tool, input, outcome }) => (
        <section key={question} className="flex flex-col gap-2">
          <p className="text-sm font-medium">“{question}”</p>
          <p className="font-mono text-xs text-muted">{tool}({JSON.stringify(input)})</p>
          {outcome.ok ? (
            <>
              <CardView card={outcome.card} />
              <details className="text-xs text-ink-2">
                <summary className="cursor-pointer">What the model sees</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-wash p-2">{JSON.stringify(outcome.model, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className="text-sm text-critical">{outcome.error}</p>
          )}
        </section>
      ))}
    </main>
  );
}

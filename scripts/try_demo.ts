// The no-key demo agent: the six prepared questions and the Try-it ideas must call the verified SQL tools.
//   npm run try:demo
import { runDemoTurn } from "../lib/demo-agent";
import type { ChatEvent } from "../lib/protocol";

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)?.slice(0, 300)})`}`);
}

type History = Parameters<typeof runDemoTurn>[0]["history"];
async function ask(message: string, history: History = []) {
  const events: ChatEvent[] = [];
  await runDemoTurn({ history, message, send: (event) => events.push(event) });
  return events;
}

async function main() {
  const questions = [
    "How much did I spend on taxis last month?",
    "Where does my money really go?",
    "How much can I spend this week?",
    "What if I cut dining out by 20%?",
    "Is that normal for my age?",
    "What kind of spender am I?",
  ];
  const expected = ["number", "bars", "safe_to_spend", "cut", "benchmark", "profile"];
  for (let i = 0; i < questions.length; i++) {
    const events = await ask(questions[i]);
    const cards = events.filter((event): event is Extract<ChatEvent, { type: "card" }> => event.type === "card");
    check(`${questions[i]} -> ${expected[i]} card`, cards.some((event) => event.card.kind === expected[i]), events.map((event) => event.type));
    check("turn finishes cleanly", events.at(-1)?.type === "done");
  }

  const finnishQuestions = [
    ["Paljonko käytin takseihin viime kuussa?", "number"],
    ["Mihin rahani oikeasti menevät?", "bars"],
    ["Paljonko voin käyttää tällä viikolla?", "safe_to_spend"],
    ["Entä jos vähentäisin ravintoloita 20 %?", "cut"],
    ["Onko se tavallista ikäiselleni?", "benchmark"],
    ["Millainen kuluttaja olen?", "profile"],
  ] as const;
  for (const [question, kind] of finnishQuestions) {
    const events = await ask(question);
    check(`Finnish: ${question} -> ${kind}`, events.some((event) => event.type === "card" && event.card.kind === kind));
  }
  for (const [question, kind] of [
    ["What else could I cut?", "ideas"],
    ["Mitä muuta voisin vähentää?", "ideas"],
    ["What if I cut taxis by 30%?", "cut"],
  ] as const) {
    const events = await ask(question);
    check(`${question} -> ${kind} card`, events.some((event) => event.type === "card" && event.card.kind === kind));
  }
  const taxiCut = (await ask("What if I cut taxis by 30%?")).find((event) => event.type === "card");
  check("taxi cut targets everyday Taxi at 30%", taxiCut?.type === "card" && taxiCut.card.kind === "cut"
    && taxiCut.card.title === "Taxi" && taxiCut.card.cut_pct === 30, taxiCut);
  const datedCut = (await ask("What if I cut taxis last month by 30%?")).find((event) => event.type === "card");
  check("a dated taxi cut stays a what-if, with that month's spending", datedCut?.type === "card" && datedCut.card.kind === "cut"
    && datedCut.card.monthly_now === 207.65 && datedCut.card.cut_pct === 30);

  let history: History = [];
  const shown = new Set<string>();
  let exhausted = false;
  for (let round = 0; round < 20; round++) {
    const events = await ask(round === 0 ? "What else could I cut?" : "More ideas", history);
    const card = events.find((event) => event.type === "card");
    if (card?.type !== "card" || card.card.kind !== "ideas") { check("follow-up returns an ideas card", false); break; }
    const names = card.card.ideas.map((idea) => idea.key);
    check(`follow-up ${round + 1} avoids previously shown ideas`, names.every((name) => !shown.has(name)), names);
    names.forEach((name) => shown.add(name));
    const done = events.find((event) => event.type === "done");
    if (done?.type !== "done") { check("follow-up has signed-history content", false); break; }
    history = done.history as History;
    if (names.length === 0) {
      exhausted = true;
      check("empty ideas get a useful message", events.some((e) => e.type === "text" && e.text.includes("No more ideas")));
      break;
    }
  }
  check("idea follow-ups finish after the available groups", exhausted && shown.size > 3, shown.size);
  check("fallback history carries compact tool results without transaction rows or ids",
    history.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"))
      && !/tx_ids|amount_eur|balance_after_eur|merchant_id/.test(JSON.stringify(history)));

  const finnish = await ask("Paljonko voin käyttää tällä viikolla?");
  check("Finnish question gets a Finnish explanation", finnish.some((event) => event.type === "text" && event.text.includes("palkkapäivään")));

  const unknown = await ask("Can you predict the stock market?");
  check("unsupported demo question is bounded and does not guess", unknown.map((event) => event.type).join() === "notice,done");

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nall no-key demo checks passed");
  process.exit(failed ? 1 : 0);
}

main();

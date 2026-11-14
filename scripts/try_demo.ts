// The no-key demo agent: all six prepared questions must still call the verified SQL tools.
//   npm run try:demo
import { runDemoTurn } from "../lib/demo-agent";
import type { ChatEvent } from "../lib/protocol";

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)?.slice(0, 300)})`}`);
}

async function ask(message: string) {
  const events: ChatEvent[] = [];
  await runDemoTurn({ history: [], message, send: (event) => events.push(event) });
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
  const finnish = await ask("Paljonko voin käyttää tällä viikolla?");
  check("Finnish question gets a Finnish explanation", finnish.some((event) => event.type === "text" && event.text.includes("palkkapäivään")));

  const unknown = await ask("Can you predict the stock market?");
  check("unsupported demo question is bounded and does not guess", unknown.map((event) => event.type).join() === "notice,done");

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nall no-key demo checks passed");
  process.exit(failed ? 1 : 0);
}

main();

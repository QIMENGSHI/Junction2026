// A credit-free fallback for the six questions in Kori's three-minute demo. It is deliberately
// narrow: fixed phrase matching chooses the same verified SQL tools the model would choose, and
// every number still comes from those tools. The real Anthropic agent remains the primary path
// whenever ANTHROPIC_API_KEY is configured.
import type Anthropic from "@anthropic-ai/sdk";
import type { ChatEvent } from "./protocol";
import { executeTool } from "./tools";

type HistoryItem = Anthropic.Beta.BetaMessageParam;

type DemoCall = {
  name: string;
  input: Record<string, unknown>;
};

type DemoIntent = {
  calls: DemoCall[];
  english: string;
  finnish: string;
};

const normalize = (message: string) => message.toLocaleLowerCase("fi-FI").replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();

function isFinnish(text: string) {
  return /paljonko|mihin|raha|voin|käyttää|vähentä|ravintol|ikä|kuluttaja|taks|viime|viik/u.test(text);
}

function intentFor(message: string): DemoIntent | null {
  const text = normalize(message);

  if ((text.includes("taxi") || text.includes("taks")) &&
      (text.includes("last month") || text.includes("viime kuussa") || text.includes("viime kuukauden"))) {
    if (text.includes("show") || text.includes("näytä")) {
      return {
        calls: [{ name: "list_transactions", input: { label: "Taxi", period: "last_month" } }],
        english: "Here are the taxi rides from the most recent complete month.",
        finnish: "Tässä ovat viimeisimmän kokonaisen kuukauden taksimatkat.",
      };
    }
    return {
      calls: [{ name: "spend_by", input: { group_by: "total", label: "Taxi", period: "last_month" } }],
      english: "The card shows the total and every ride behind it.",
      finnish: "Kortti näyttää summan ja kaikki sen taustalla olevat matkat.",
    };
  }

  if (text.includes("where does my money") || text.includes("money really go") ||
      text.includes("mihin rahani") || text.includes("mihin raha")) {
    return {
      calls: [
        { name: "spend_by", input: { group_by: "basket", period: "all" } },
        { name: "spend_by", input: { group_by: "category", basket: "everyday", period: "all" } },
      ],
      english: "Everyday spending is close to your regular bills, and restaurants are its largest category.",
      finnish: "Arjen menot ovat lähes säännöllisten laskujen tasolla, ja ravintolat ovat niiden suurin ryhmä.",
    };
  }

  if (text.includes("safe to spend") || text.includes("spend this week") ||
      (text.includes("paljonko") && text.includes("käyttää")) || text.includes("turvallista käyttää")) {
    return {
      calls: [{ name: "safe_to_spend", input: {} }],
      english: "This keeps your bills, irregular-cost buffer and savings goal protected until payday.",
      finnish: "Laskut, epäsäännöllisten menojen puskuri ja säästötavoite pysyvät suojassa palkkapäivään asti.",
    };
  }

  if ((text.includes("cut") || text.includes("vähentä")) &&
      (text.includes("dining") || text.includes("restaurant") || text.includes("ravintol"))) {
    const asked = Number(text.match(/\b(\d{1,3})\s*%?/)?.[1] ?? 20);
    const pct = Number.isInteger(asked) && asked >= 1 && asked <= 100 ? asked : 20;
    return {
      calls: [{ name: "simulate_cut", input: { category: "Restaurants", pct } }],
      english: "Move the slider to compare other cuts; every step was calculated by the SQL tool.",
      finnish: "Liikuta säädintä ja vertaa muita vähennyksiä; SQL-työkalu on laskenut jokaisen askeleen.",
    };
  }

  if (text.includes("normal for my age") || text.includes("normal at my age") ||
      (text.includes("normal") && text.includes("age")) || text.includes("ikäiselleni") ||
      (text.includes("tavallista") && text.includes("ikä"))) {
    return {
      calls: [{ name: "benchmark", input: { category: "Restaurants" } }],
      english: "Restaurants stand out most clearly against people in your age group.",
      finnish: "Ravintolamenot erottuvat selvimmin, kun niitä verrataan omaan ikäryhmääsi.",
    };
  }

  if (text.includes("kind of spender") || text.includes("spender am i") ||
      text.includes("millainen kuluttaja") || text.includes("kuluttajatyyppi")) {
    return {
      calls: [{ name: "spender_profile", input: {} }],
      english: "The profile is based on where and when your own everyday spending happens.",
      finnish: "Profiili perustuu siihen, mihin ja milloin omat arjen menosi syntyvät.",
    };
  }

  return null;
}

export const canRunDemo = (message: string) => intentFor(message) !== null;

export async function runDemoTurn({ history, message, send }: {
  history: HistoryItem[];
  message: string;
  send: (event: ChatEvent) => void;
}) {
  const intent = intentFor(message);
  if (!intent) {
    const reply = isFinnish(normalize(message))
      ? "Esittelytila osaa kuusi demokysymystä. Valitse yksi ehdotuksista tai lisää ANTHROPIC_API_KEY vapaamuotoista keskustelua varten."
      : "Demo mode supports the six prepared questions. Choose a suggestion, or add ANTHROPIC_API_KEY for open-ended chat.";
    send({ type: "notice", message: reply });
    send({ type: "done", history: [...history, { role: "user", content: message }, { role: "assistant", content: reply }] });
    return;
  }

  const results = await Promise.all(intent.calls.map(async (call, index) => {
    const id = `demo_${Date.now()}_${index}`;
    send({ type: "tool", id, name: call.name });
    return { id, outcome: await executeTool(call.name, call.input) };
  }));

  for (const { id, outcome } of results) {
    if (outcome.ok) send({ type: "card", id, card: outcome.card });
    else send({ type: "tool_error", id, message: outcome.error });
  }

  const reply = isFinnish(normalize(message)) ? intent.finnish : intent.english;
  send({ type: "text", text: reply });
  send({ type: "done", history: [...history, { role: "user", content: message }, { role: "assistant", content: reply }] });
}

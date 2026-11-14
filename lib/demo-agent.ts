// A credit-free fallback for the six questions in Kori's three-minute demo. It is deliberately
// narrow: fixed phrase matching chooses the same verified SQL tools the model would choose, and
// every number still comes from those tools. The real Anthropic agent remains the primary path
// whenever ANTHROPIC_API_KEY is configured.
import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { copy } from "./i18n";
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
  return /paljonko|mihin|raha|voin|käyttää|vähentä|sääst|ideoita|ravintol|ikä|kuluttaja|taks|viime|viik/u.test(text);
}

function intentFor(message: string): DemoIntent | null {
  const text = normalize(message);
  const wantsCut = text.includes("cut") || text.includes("vähentä");

  if ((text.includes("taxi") || text.includes("taks")) &&
      (text.includes("last month") || text.includes("viime kuussa") || text.includes("viime kuukauden")) && !wantsCut) {
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

  if (text.includes("what else could i cut") || text.includes("what could i cut") || text.includes("what should i cut") ||
      text.includes("how can i save") || text.includes("another idea") || text.includes("more ideas") || text.includes("try it") ||
      text.includes("mitä muuta voisin vähentää") || text.includes("mitä voisin vähentää") ||
      text.includes("miten säästäisin") || text.includes("miten voisin säästää") || text.includes("lisää ideoita")) {
    return {
      calls: [{ name: "suggest_cuts", input: {} }],
      english: "Explore these ideas from your everyday spending; every slider step comes from the SQL tools.",
      finnish: "Tutustu arjen menoistasi löytyviin ideoihin. SQL-työkalut laskevat säätimen jokaisen askeleen.",
    };
  }

  if (wantsCut) {
    const target = text.includes("taxi") || text.includes("taks") ? { label: "Taxi", basket: "everyday" }
      : text.includes("dining") || text.includes("restaurant") || text.includes("ravintol") ? { category: "Restaurants" }
      : null;
    if (target) {
      const asked = Number(text.match(/\b(\d{1,3})\s*%?/)?.[1] ?? 20);
      const pct = Number.isInteger(asked) && asked >= 1 && asked <= 100 ? asked : 20;
      const period = text.includes("this month") || text.includes("tässä kuussa") ? "this_month"
        : text.includes("last month") || text.includes("viime kuussa") ? "last_month" : undefined;
      return {
        calls: [{ name: "simulate_cut", input: { ...target, pct, ...(period ? { period } : {}) } }],
        english: "Move the slider to compare other cuts; every step was calculated by the SQL tool.",
        finnish: "Liikuta säädintä ja vertaa muita vähennyksiä; SQL-työkalu on laskenut jokaisen askeleen.",
      };
    }
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

/** Read only structured, server-produced tool results, never numbers or claims in user text. */
function shownIdeas(history: HistoryItem[]) {
  const requests = new Set<string>();
  const shown = new Set<string>();
  for (const message of history) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type === "tool_use" && block.name === "suggest_cuts") requests.add(block.id);
      if (block.type !== "tool_result" || !requests.has(block.tool_use_id) || typeof block.content !== "string") continue;
      try {
        const result = JSON.parse(block.content) as { ideas?: { cutting?: unknown }[] };
        if (Array.isArray(result.ideas)) for (const idea of result.ideas) {
          if (typeof idea.cutting === "string") shown.add(idea.cutting);
        }
      } catch { /* An error result is not an earlier idea. */ }
    }
  }
  return [...shown].slice(-50);
}

export async function runDemoTurn({ history, message, send }: {
  history: HistoryItem[];
  message: string;
  send: (event: ChatEvent) => void;
}) {
  const intent = intentFor(message);
  if (!intent) {
    const reply = isFinnish(normalize(message))
      ? "Kysy menoistasi, viikon käyttövarasta tai säästöideoista."
      : "Try asking about spending, your weekly budget, or ideas for saving.";
    send({ type: "notice", message: reply });
    send({ type: "done", history: [...history, { role: "user", content: message }, { role: "assistant", content: reply }] });
    return;
  }

  const results = await Promise.all(intent.calls.map(async (call) => {
    const id = `toolu_demo_${randomUUID().replaceAll("-", "")}`;
    const input = call.name === "suggest_cuts" ? { ...call.input, exclude: shownIdeas(history) } : call.input;
    send({ type: "tool", id, name: call.name });
    return { id, name: call.name, input, outcome: await executeTool(call.name, input) };
  }));

  for (const { id, outcome } of results) {
    if (outcome.ok) send({ type: "card", id, card: outcome.card });
    else send({ type: "tool_error", id, message: outcome.error });
  }

  const language = isFinnish(normalize(message)) ? "fi" : "en";
  const empty = results.every(({ outcome }) => outcome.ok && outcome.card.kind === "ideas" && outcome.card.ideas.length === 0);
  const reply = empty ? copy(language, "noCutIdeas")
    : results.every(({ outcome }) => !outcome.ok)
      ? language === "fi" ? "Laskelma ei onnistunut. Yritä uudelleen." : "Couldn’t calculate that just now. Try again."
      : language === "fi" ? intent.finnish : intent.english;
  send({ type: "text", text: reply });
  send({ type: "done", history: [...history,
    { role: "user", content: message },
    { role: "assistant", content: results.map(({ id, name, input }) => ({ type: "tool_use", id, name, input })) },
    { role: "user", content: results.map(({ id, outcome }) => ({ type: "tool_result", tool_use_id: id,
      content: outcome.ok ? JSON.stringify(outcome.model) : outcome.error, ...(!outcome.ok ? { is_error: true } : {}) })) },
    { role: "assistant", content: reply },
  ] });
}

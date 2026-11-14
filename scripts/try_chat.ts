// The chat loop with a scripted stand-in for Claude: checks the events the browser gets, the
// history it keeps, refusals, bad tool input and fallback echoing - without an API key.
//   npm run try:chat
import type Anthropic from "@anthropic-ai/sdk";
import { runTurn, type OpenStream } from "../lib/agent";
import type { ChatEvent } from "../lib/protocol";

type BetaMessage = Anthropic.Beta.BetaMessage;
type Params = Parameters<OpenStream>[0];

let failed = 0;
function check(name: string, ok: boolean, got?: unknown) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  (got ${JSON.stringify(got)?.slice(0, 300)})`}`);
}

/** A fake model: each call returns the next scripted reply and streams its text. */
function scripted(replies: Array<{ content: unknown[]; stop_reason: string }>) {
  const seen: Params[] = [];
  const openStream: OpenStream = (params) => {
    seen.push(structuredClone(params));
    const reply = replies.shift();
    if (!reply) throw new Error("script ran out of replies");
    const listeners: Array<(delta: string) => void> = [];
    return {
      on: (_event, listener) => listeners.push(listener),
      finalMessage: async () => {
        for (const block of reply.content as Array<{ type: string; text?: string }>) {
          if (block.type === "text" && block.text) listeners.forEach((l) => l(block.text!));
        }
        return { ...reply, id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5" } as unknown as BetaMessage;
      },
    };
  };
  return { openStream, seen };
}

async function turn(openStream: OpenStream, history: Anthropic.Beta.BetaMessageParam[], message: string) {
  const events: ChatEvent[] = [];
  await runTurn({ openStream, history, message, send: (e) => events.push(e) });
  const done = events.find((e): e is Extract<ChatEvent, { type: "done" }> => e.type === "done");
  return { events, history: (done?.history ?? []) as Anthropic.Beta.BetaMessageParam[] };
}

const thinking = { type: "thinking", thinking: "", signature: "sig-abc" };

async function main() {
  console.log('Q2 "How much did I spend on taxis last month?"');
  const q2 = scripted([
    { content: [thinking, { type: "tool_use", id: "toolu_1", name: "spend_by", input: { group_by: "total", label: "Taxi", period: "last_month" } }], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "You spent €207.65 on three taxi rides in September." }], stop_reason: "end_turn" },
  ]);
  const t1 = await turn(q2.openStream, [], "How much did I spend on taxis last month?");
  console.log("   events:", t1.events.map((e) => e.type).join(" -> "));
  check("events: tool, card, text, done", t1.events.map((e) => e.type).join() === "tool,card,text,done");
  const card = t1.events.find((e) => e.type === "card");
  check("the card is the €207.65 number card", card?.type === "card" && card.card.kind === "number" && card.card.eur === 207.65, card);
  const toolResult = JSON.stringify(t1.history[2]);
  check("the tool result sent back to the model carries figures, not ids", toolResult.includes("207.65") && !toolResult.includes("tx_ids"), toolResult);
  check("history: user, assistant (thinking + tool call), tool result, assistant text", t1.history.length === 4 && JSON.stringify(t1.history[1]).includes("sig-abc"));

  const params = q2.seen[0];
  check("request: claude-opus-5-5, effort low, fallbacks default, prompt caching, 6 tools",
    params.model === "claude-opus-5-5" && params.output_config?.effort === "low" && params.fallbacks === "default"
    && params.cache_control?.type === "ephemeral" && params.betas?.includes("server-side-fallback-2026-07-01") === true
    && params.tools?.length === 6, params);
  check("request: no sampling parameters or thinking switch (Opus 5.5 rejects them)",
    !("temperature" in params) && !("top_p" in params) && !("thinking" in params));

  console.log('\nQ3, the next turn: "Where does my money really go?"');
  const q3 = scripted([
    { content: [thinking, { type: "tool_use", id: "toolu_2", name: "spend_by", input: { group_by: "basket", period: "all" } },
                { type: "tool_use", id: "toolu_3", name: "spend_by", input: { group_by: "category", basket: "everyday", period: "all" } }], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "About €1,347.60 a month goes on everyday spending; restaurants alone are €540.34." }], stop_reason: "end_turn" },
  ]);
  const t2 = await turn(q3.openStream, t1.history, "Where does my money really go?");
  check("the earlier turn is sent back unchanged (append-only, thinking intact)",
    JSON.stringify(q3.seen[0].messages.slice(0, 4)) === JSON.stringify(t1.history));
  const bars = t2.events.filter((e) => e.type === "card");
  check("two parallel tool calls give two bar charts", bars.length === 2 && bars.every((e) => e.type === "card" && e.card.kind === "bars"));
  const results = t2.history[t2.history.length - 2];
  check("both tool results go back in one message", Array.isArray(results.content) && results.content.length === 2);

  console.log("\nA refusal");
  const refused = scripted([{ content: [], stop_reason: "refusal" }]);
  const t3 = await turn(refused.openStream, t2.history, "something the classifier declines");
  check("the customer gets a notice and the declined question stays out of the history",
    t3.events.map((e) => e.type).join() === "notice,done" && JSON.stringify(t3.history) === JSON.stringify(t2.history));

  console.log("\nBad tool input");
  const bad = scripted([
    { content: [{ type: "tool_use", id: "toolu_4", name: "spend_by", input: { group_by: "vibes", period: "all" } }], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "Sorry, let me try that differently." }], stop_reason: "end_turn" },
  ]);
  const t4 = await turn(bad.openStream, [], "break it");
  const errorResult = JSON.stringify(t4.history[2]);
  check("invalid input becomes a tool_error event and an is_error result with INVALID_JSON",
    t4.events.some((e) => e.type === "tool_error") && errorResult.includes('"is_error":true') && errorResult.includes("INVALID_JSON"), errorResult);

  console.log("\nA fallback in the middle of an answer");
  const fb = scripted([{
    content: [thinking, { type: "text", text: "Part one. " }, { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } },
              { type: "thinking", thinking: "", signature: "sig-after" }, { type: "text", text: "Part two." }],
    stop_reason: "end_turn",
  }]);
  const t5 = await turn(fb.openStream, [], "hello");
  const echoed = (t5.history[1].content as Array<{ type: string }>).map((b) => b.type).join();
  check("thinking before the fallback is dropped; the fallback block and everything after stay", echoed === "text,fallback,thinking,text", echoed);

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nall chat-loop checks passed");
  process.exit(failed ? 1 : 0);
}

main();

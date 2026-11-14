// One chat turn: the model picks tools, the tools run fixed SQL, cards go to the screen, and the
// model writes a sentence or two. The conversation lives in the browser and comes back with each
// question, so the server keeps no state (it can run as a serverless function).
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages";
import { EFFORT, MAX_TOOL_ROUNDS, MODEL } from "./config";
import type { ChatEvent } from "./protocol";
import { systemPrompt } from "./prompt";
import { apiTools, executeTool } from "./tools";

type BetaMessage = Anthropic.Beta.BetaMessage;
type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;

/** The part of the SDK the loop uses. The route passes the real client; a test passes a script. */
export type OpenStream = (params: BetaMessageStreamParams) => {
  on(event: "text", listener: (delta: string) => void): unknown;
  finalMessage(): Promise<BetaMessage>;
};

const REFUSED = "Kori can't help with that one. Ask about your spending, your baskets or what is safe to spend.";

/** After a mid-answer switch to a fallback model, the declined part is echoed back without its
 *  thinking and tool calls; the fallback block stays where it was (Anthropic's echo rules). */
function echoable(content: BetaContentBlock[]): BetaContentBlock[] {
  const boundary = content.map((block) => block.type).lastIndexOf("fallback");
  if (boundary < 0) return content;
  return content.filter((block, i) => i >= boundary || block.type === "text");
}

export async function runTurn({ openStream, history, message, send }: {
  openStream: OpenStream;
  history: BetaMessageParam[];
  message: string;
  send: (event: ChatEvent) => void;
}): Promise<void> {
  const messages: BetaMessageParam[] = [...history, { role: "user", content: message }];
  const [system, tools] = await Promise.all([systemPrompt(), apiTools()]);
  let unparseable = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let reply: BetaMessage;
    try {
      const stream = openStream({
        model: MODEL,
        max_tokens: 64000, // thinking counts toward this too; answers themselves are short
        system,
        tools,
        messages,
        output_config: { effort: EFFORT },
        cache_control: { type: "ephemeral" }, // cache tools + system + history between turns
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // if a safety classifier declines, the API retries on a fallback model
      });
      stream.on("text", (delta) => send({ type: "text", text: delta }));
      reply = await stream.finalMessage();
      unparseable = 0;
    } catch (error) {
      // With eager input streaming, a tool input that isn't JSON at all rejects here. Re-ask
      // (at most twice in a row); API errors such as auth or rate limits go straight up.
      if (error instanceof Anthropic.APIError || unparseable++ >= 2) throw error;
      continue;
    }

    if (reply.stop_reason === "refusal") {
      // Leave the declined question out of the history so it isn't sent again.
      send({ type: "notice", message: REFUSED });
      send({ type: "done", history });
      return;
    }

    messages.push({ role: "assistant", content: echoable(reply.content) });
    if (reply.stop_reason === "pause_turn") continue;

    const calls = reply.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
    if (calls.length === 0) break;
    if (reply.stop_reason === "max_tokens") throw new Error("A tool call was cut off by max_tokens.");

    // Run every call in parallel and answer them all in one message.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(calls.map(async (call) => {
      send({ type: "tool", id: call.id, name: call.name });
      const outcome = await executeTool(call.name, call.input);
      if (outcome.ok) {
        send({ type: "card", id: call.id, card: outcome.card });
        return { type: "tool_result" as const, tool_use_id: call.id, content: JSON.stringify(outcome.model) };
      }
      send({ type: "tool_error", id: call.id, message: outcome.error });
      return { type: "tool_result" as const, tool_use_id: call.id, content: outcome.error, is_error: true };
    }));
    messages.push({ role: "user", content: results });
  }

  send({ type: "done", history: messages });
}

/** A plain-language error for the chat, from the SDK's typed errors. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Claude rejected the API key. Check ANTHROPIC_API_KEY in kori/.env.local.";
  }
  if (error instanceof Anthropic.RateLimitError) return "Claude is rate-limiting requests. Try again in a moment.";
  if (error instanceof Anthropic.APIConnectionError) return "Can't reach Claude. Check the network connection.";
  if (error instanceof Anthropic.APIError) return `Claude returned an error (${error.status}): ${error.message}`;
  if (error instanceof Anthropic.AnthropicError) {
    return `Kori can't start Claude: ${error.message.replace(/\.?\s*$/, ".")} Add ANTHROPIC_API_KEY to kori/.env.local and restart.`;
  }
  return error instanceof Error ? error.message : String(error);
}

import Anthropic from "@anthropic-ai/sdk";
import { describeError, runTurn } from "@/lib/agent";
import { DEMO_MODE, USE_DEMO_AGENT } from "@/lib/config";
import { canRunDemo, runDemoTurn } from "@/lib/demo-agent";
import { signHistory, verifyHistory } from "@/lib/history-token";
import type { ChatEvent, ClientChatEvent } from "@/lib/protocol";

export const runtime = "nodejs"; // DuckDB is a native module
export const maxDuration = 60;

type HistoryItem = Anthropic.Beta.BetaMessageParam;

/** The conversation comes back from the browser; accept only the shape the API itself takes. */
function readHistory(value: unknown): HistoryItem[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const encoded = JSON.stringify(value);
  // The official UI only returns compact aggregates. Reject oversized or accidentally row-level
  // history before it can cross the model boundary, even if a client tampers with the request.
  if (encoded.length > 500_000 || /"(?:tx_id|tx_ids|amount_eur|balance_after_eur|merchant_id|mcc_code)"\s*:/u.test(encoded)) return null;
  const ok = value.every((item) =>
    item && typeof item === "object" &&
    ((item as HistoryItem).role === "user" || (item as HistoryItem).role === "assistant") &&
    (typeof (item as HistoryItem).content === "string" || Array.isArray((item as HistoryItem).content)));
  return ok ? (value as HistoryItem[]) : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { message?: unknown; history_token?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const unsigned = verifyHistory(body?.history_token);
  const history = unsigned && readHistory(unsigned);
  if (!message || !history) {
    return Response.json({ error: "Send a message with a valid Kori history token." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentAnswer = false;
      const send = (event: ChatEvent) => {
        if (event.type !== "done") sentAnswer ||= event.type !== "error";
        const clientEvent: ClientChatEvent = event.type === "done"
          ? { type: "done", history_token: signHistory(event.history) }
          : event;
        controller.enqueue(encoder.encode(`${JSON.stringify(clientEvent)}\n`));
      };
      try {
        if (USE_DEMO_AGENT) {
          await runDemoTurn({ history, message, send });
        } else {
          const client = new Anthropic();
          await runTurn({ openStream: (params) => client.beta.messages.stream(params), history, message, send });
        }
      } catch (error) {
        if (!sentAnswer && DEMO_MODE === "auto" && canRunDemo(message) && error instanceof Anthropic.AnthropicError) {
          console.warn("[kori] live model unavailable; using prepared demo tool route:", error.constructor.name);
          try {
            await runDemoTurn({ history, message, send });
          } catch (fallbackError) {
            console.error("[kori] demo fallback failed:", fallbackError);
            send({ type: "error", message: describeError(fallbackError) });
          }
        } else {
          console.error("[kori] chat turn failed:", error);
          send({ type: "error", message: describeError(error) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

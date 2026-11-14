"use client";

import { useCallback, useRef, useState } from "react";
import type { Card, ClientChatEvent } from "@/lib/protocol";

/** A piece of an answer, in the order it arrived: words, or a tool call that becomes a card. */
export type Segment =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; card?: Card; error?: string };

export type AssistantTurn = {
  role: "assistant";
  segments: Segment[];
  status: "streaming" | "done" | "error";
  error?: string;
  notice?: string;
};
export type Turn = { role: "user"; text: string } | AssistantTurn;

export function useKoriChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  // The API conversation, kept exactly as the server returned it (thinking blocks included) and
  // sent back unchanged with the next question.
  const historyToken = useRef<string | null>(null);

  const updateAnswer = useCallback((change: (turn: AssistantTurn) => AssistantTurn) => {
    setTurns((all) => {
      const last = all.at(-1);
      return last?.role === "assistant" ? [...all.slice(0, -1), change(last)] : all;
    });
  }, []);

  const apply = useCallback((event: ClientChatEvent) => {
    switch (event.type) {
      case "text":
        updateAnswer((turn) => {
          const segments = [...turn.segments];
          const last = segments.at(-1);
          if (last?.type === "text") segments[segments.length - 1] = { ...last, text: last.text + event.text };
          else segments.push({ type: "text", text: event.text });
          return { ...turn, segments };
        });
        break;
      case "tool":
        updateAnswer((turn) => ({ ...turn, segments: [...turn.segments, { type: "tool", id: event.id, name: event.name }] }));
        break;
      case "card":
      case "tool_error":
        updateAnswer((turn) => ({
          ...turn,
          segments: turn.segments.map((segment) =>
            segment.type === "tool" && segment.id === event.id
              ? event.type === "card" ? { ...segment, card: event.card } : { ...segment, error: event.message }
              : segment),
        }));
        break;
      case "notice":
        updateAnswer((turn) => ({ ...turn, notice: event.message }));
        break;
      case "done":
        historyToken.current = event.history_token;
        updateAnswer((turn) => ({ ...turn, status: "done" }));
        break;
      case "error":
        updateAnswer((turn) => ({ ...turn, status: "error", error: event.message }));
        break;
    }
  }, [updateAnswer]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setTurns((all) => [...all, { role: "user", text: message }, { role: "assistant", segments: [], status: "streaming" }]);
    let finished = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history_token: historyToken.current }),
      });
      if (!response.ok || !response.body) throw new Error(`The server answered ${response.status}.`);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line) as ClientChatEvent;
          if (event.type === "done" || event.type === "error") finished = true;
          apply(event);
        }
      }
      if (!finished) throw new Error("The answer was cut off. Check the connection and ask again.");
    } catch (error) {
      updateAnswer((turn) => ({ ...turn, status: "error", error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  }, [apply, busy, updateAnswer]);

  const reset = useCallback(() => {
    historyToken.current = null;
    setTurns([]);
  }, []);

  return { turns, busy, send, reset };
}

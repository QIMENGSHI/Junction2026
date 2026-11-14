// The browser keeps conversation state, but cannot be allowed to forge prior tool results. The
// token is a signed, expiring envelope: serverless-friendly, opaque to the UI, and stateless.
import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = 1;
const MAX_TOKEN_LENGTH = 900_000;
const TTL_MS = 2 * 60 * 60 * 1000;

function secret() {
  // A funded live deployment is automatically protected by its API key. KORI_HISTORY_SECRET lets
  // operators rotate history independently. The public fallback is only for the no-model demo.
  return process.env.KORI_HISTORY_SECRET ?? process.env.ANTHROPIC_API_KEY ?? "kori-credit-free-demo-history-v1";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signHistory(history: unknown[]) {
  const payload = Buffer.from(JSON.stringify({ v: VERSION, exp: Date.now() + TTL_MS, history }), "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyHistory(token: unknown): unknown[] | null {
  if (token === null || token === undefined || token === "") return [];
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra !== undefined) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: unknown; exp?: unknown; history?: unknown };
    if (parsed.v !== VERSION || typeof parsed.exp !== "number" || parsed.exp < Date.now() || !Array.isArray(parsed.history)) return null;
    return parsed.history;
  } catch {
    return null;
  }
}

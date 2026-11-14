// Browser conversation state is accepted only when it has a valid server signature.
import { signHistory, verifyHistory } from "../lib/history-token";

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) failed++;
  console.log(`   ${ok ? "ok  " : "FAIL"}  ${name}`);
}

const history = [
  { role: "user", content: "Where does my money go?" },
  { role: "assistant", content: "The verified cards show the answer." },
];
const token = signHistory(history);
check("a signed history round-trips", JSON.stringify(verifyHistory(token)) === JSON.stringify(history));
check("a changed payload is rejected", verifyHistory(`${token[0] === "a" ? "b" : "a"}${token.slice(1)}`) === null);
check("a changed signature is rejected", verifyHistory(`${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`) === null);
check("an empty first turn starts with empty history", JSON.stringify(verifyHistory(undefined)) === "[]");
check("an arbitrary client array is not a token", verifyHistory(history) === null);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall signed-history checks passed");
process.exit(failed ? 1 : 0);

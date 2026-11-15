import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMarkdown } from "../components/assistant-markdown";

const render = (text: string) => renderToStaticMarkup(createElement(AssistantMarkdown, { text }));

const persona = render("You're a **Night-out spender**: €974.55 of your €1,347.60 monthly spending.");
assert.match(persona, /<strong[^>]*>Night-out spender<\/strong>/);
assert(!persona.includes("**"));
assert(persona.includes("€974.55") && persona.includes("€1,347.60"));

const formatted = render("*Kokeile* `20%`.\n\n- First idea\n- Second idea\n\n[Details](https://example.com)");
assert.match(formatted, /<em>Kokeile<\/em>/);
assert.match(formatted, /<code[^>]*>20%<\/code>/);
assert.match(formatted, /<ul[^>]*>/);
assert.equal((formatted.match(/<li>/g) ?? []).length, 2);
assert(formatted.includes('href="https://example.com"'));

const escaped = render("Keep \\*\\*literal stars\\*\\* and €12.34.");
assert(escaped.includes("**literal stars**"));
assert(!escaped.includes("<strong"));
assert.doesNotThrow(() => render("You're a **Night-out")); // An unfinished streaming chunk.

const untrusted = render('<script>alert(1)</script>\n\n<img src="https://example.com/track">\n\n![track](https://example.com/track)\n\n[unsafe](javascript:alert%281%29)');
assert(!untrusted.includes("<script") && !untrusted.includes("<img"));
assert(!untrusted.includes("javascript:") && !untrusted.includes("https://example.com/track"));

console.log("Markdown checks passed: bold, emphasis, code, lists, links, preserved figures, streaming fragments, escapes and unsafe content.");

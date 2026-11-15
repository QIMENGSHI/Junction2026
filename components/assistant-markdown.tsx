import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";

function Heading({ children }: { children?: ReactNode }) {
  return <h3 className="font-semibold">{children}</h3>;
}

const components: Components = {
  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{children}</a>
    : <span>{children}</span>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-line pl-3 text-ink-2">{children}</blockquote>,
  pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-wash p-3 text-sm">{children}</pre>,
  code: ({ children }) => <code className="rounded bg-wash px-1 font-mono text-[0.9em]">{children}</code>,
  h1: Heading, h2: Heading, h3: Heading, h4: Heading, h5: Heading, h6: Heading,
};

/** Format accumulated assistant text as it streams. Raw HTML and remote images are disabled;
 *  react-markdown's default URL transform also rejects unsafe link protocols. */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words leading-relaxed [&>*+*]:mt-3">
      <Markdown skipHtml disallowedElements={["img"]} components={components}>{text}</Markdown>
    </div>
  );
}

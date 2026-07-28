"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { CopyMoment } from "@/components/app/copy-moment";

// Render an assistant reply as real Markdown, headings, lists, bold, tables,
// instead of raw text. Any fenced block becomes a CodeBlock with its own copy
// button, which is where the paste-ready prompt lives. Fully self-contained:
// doesn't touch any chat state, just the string it's given.
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          // Every markdown level renders on the same <h3> DOM level, not a
          // level-for-level shift (QA finding A-4). The old mapping (h1→h2,
          // h2→h3, h3→h4) compounded whatever depth the model happened to
          // pick: a reply opening straight with ### — a common model habit,
          // treating it as "the" section header — landed on h4, skipping
          // both h2 and h3 in the surrounding page (a project chat already
          // has h1 the project name and h2 the chat title before any reply
          // content starts). One fixed level can't erase every skip in every
          // context (a standalone chat has only its own h1 above the reply,
          // so h3 alone still skips h2 there), but it removes the
          // compounding, and it's a straightforward mapping that doesn't need
          // the page context threaded down into a markdown renderer that
          // otherwise has none of it.
          //
          // The three sizes are kept as a purely visual cue for a reply with
          // real nested structure (# Overview / ## Requirements / ###
          // Details) — same semantic level, still visually distinguishable —
          // rather than collapsing to one indistinguishable size.
          h1: ({ children }) => (
            <h3 className="mt-1 text-[16px] font-semibold text-foreground">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mt-1 text-[15px] font-semibold text-foreground">{children}</h3>
          ),
          h3: ({ children }) => (
            <h3 className="mt-1 text-[14px] font-semibold text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h3 className="mt-1 text-[14px] font-semibold text-foreground">{children}</h3>
          ),
          h5: ({ children }) => (
            <h3 className="mt-1 text-[14px] font-semibold text-foreground">{children}</h3>
          ),
          h6: ({ children }) => (
            <h3 className="mt-1 text-[14px] font-semibold text-foreground">{children}</h3>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent-text underline underline-offset-2 hover:text-accent-text"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-secondary">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const text = String(children ?? "");
            const isBlock = (className?.includes("language-") ?? false) || text.includes("\n");
            if (isBlock) {
              return <CodeBlock text={text.replace(/\n$/, "")} />;
            }
            return (
              <code className="rounded bg-accent-subtle px-1.5 py-0.5 font-mono text-[12.5px] text-accent-text">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// The paste-ready prompt, in a bordered box with its own copy button.
function CodeBlock({ text }: { text: string }) {
  const { copied, copy, copyCount } = useCopyToClipboard();

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-black/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-tertiary">
          Prompt
        </span>
        <button
          type="button"
          onClick={() => copy(text)}
          className="inline-flex items-center gap-1 text-[12px] text-secondary transition-colors hover:text-foreground"
        >
          <CopyMoment copied={copied} copyCount={copyCount} idleLabel="Prompt kopieren" />
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
        {text}
      </pre>
    </div>
  );
}

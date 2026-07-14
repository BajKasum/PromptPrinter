"use client";

import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

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
          h1: ({ children }) => (
            <h2 className="mt-1 text-[16px] font-semibold text-foreground">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="mt-1 text-[15px] font-semibold text-foreground">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-1 text-[14px] font-semibold text-foreground">{children}</h4>
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
            <blockquote className="border-l-2 border-border pl-3 text-foreground/65">
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
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-black/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/40">
          Prompt
        </span>
        <button
          type="button"
          onClick={() => copy(text)}
          className="inline-flex items-center gap-1 text-[12px] text-foreground/55 transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Kopiert" : "Prompt kopieren"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
        {text}
      </pre>
    </div>
  );
}

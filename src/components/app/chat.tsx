"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { DolphinLoader } from "@/components/brand/dolphin-loader";
import { downloadFile } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

// The chat serves three contexts; each gets its own empty-state copy + starters.
//  - general : everyday prompts (school, writing, planning)
//  - software: software-build prompts, standalone
//  - refine  : refining the build packet of a specific project
type Variant = "general" | "software" | "refine";

const VARIANTS: Record<Variant, { heading: string; sub: string; starters: string[] }> = {
  general: {
    heading: "Wofür brauchst du einen Prompt?",
    sub: "Beschreib dein Ziel. Ich bau dir einen fertigen Prompt und verfeinere ihn mit dir.",
    starters: [
      "Hilf mir, einen Prompt zu schreiben, um Französisch-Vokabeln zu üben.",
      "Ich brauche einen Prompt, der mir einen Lernplan für meine Prüfung erstellt.",
      "Schreib mir einen Prompt für ein professionelles Bewerbungsschreiben.",
    ],
  },
  software: {
    heading: "Was willst du bauen?",
    sub: "Beschreib, was du bauen willst. Ich liefere dir einen fertigen Prompt zum Verfeinern.",
    starters: [
      "Schreib mir einen Prompt für ein React-Komponenten-Gerüst mit Tailwind.",
      "Ich brauche einen Prompt, der eine REST-API in Node.js entwirft.",
      "Erstelle einen Prompt, der ein Datenbank-Schema für eine Todo-App plant.",
    ],
  },
  refine: {
    heading: "Pass deine Prompts an",
    sub: "Sag mir, was ich an deinen Prompts ändern soll. Du bekommst die aktualisierte, fertige Version zurück.",
    starters: [
      "Mach den Master-Prompt kürzer und prägnanter.",
      "Ergänze den Frontend-Prompt um einen Dark-Mode.",
      "Erkläre das Datenbank-Schema mit mehr Kommentaren.",
    ],
  },
};

export function Chat({
  mode,
  target,
  projectId,
  initialMessages,
  initialConversationId,
}: {
  mode: "general" | "software";
  target?: string;
  projectId?: string;
  initialMessages?: Msg[];
  initialConversationId?: string;
}) {
  // Refining a project's packet is its own context; otherwise the mode picks the
  // copy. The variant only drives the empty-state heading/sub/starters.
  const variant: Variant = projectId ? "refine" : mode;
  const { heading, sub, starters } = VARIANTS[variant];

  // Placeholder mirrors the variant so the input itself reinforces what to type.
  const placeholder =
    variant === "software"
      ? "Beschreibe, was du bauen willst…"
      : variant === "refine"
        ? "Sag mir, was ich ändern soll…"
        : "Beschreibe, wofür du einen Prompt brauchst…";

  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, target, conversationId, projectId, messages: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Chat fehlgeschlagen");
      setMessages((m) => [...m, { role: "assistant", content: json.reply as string }]);
      // The route returns the conversation id on the first persisted turn; hold
      // onto it so every following turn appends to the same stored chat.
      if (json.conversationId) setConversationId(json.conversationId as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] min-h-[440px]">
      <div className="flex-1 overflow-y-auto card-surface p-5 md:p-6">
        {messages.length === 0 ? (
          <EmptyState
            heading={heading}
            sub={sub}
            starters={starters}
            onPick={(t) => send(t)}
            disabled={loading}
          />
        ) : (
          // role="log" + aria-live: screen readers announce new replies as they
          // arrive without moving focus out of the input.
          <div role="log" aria-live="polite" className="space-y-5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <UserBubble key={i} content={m.content} />
              ) : (
                <AssistantBubble key={i} content={m.content} index={i} />
              )
            )}
            {loading && <Typing />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          {error}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <Textarea
          rows={2}
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="resize-none"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Senden
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-foreground/35">
        Enter sendet · Shift+Enter neue Zeile · dieser Chat wird automatisch gespeichert.
      </p>
    </div>
  );
}

function EmptyState({
  heading,
  sub,
  starters,
  onPick,
  disabled,
}: {
  heading: string;
  sub: string;
  starters: string[];
  onPick: (t: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-10">
      {/* Finn greets you, curious to hear the idea you're about to describe. */}
      <AnimatedMascot state="curious" size={84} priority className="mx-auto mb-4" />
      <h2 className="text-[18px] font-semibold text-foreground">{heading}</h2>
      <p className="mt-1 text-[13px] text-foreground/55 max-w-sm">{sub}</p>
      <div className="mt-5 w-full max-w-md space-y-2">
        <p className="text-left text-[12px] text-foreground/45">Oder starte mit einem Beispiel:</p>
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="w-full text-left rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] text-foreground/75 hover:border-border-strong hover:bg-surface-hover hover:text-foreground active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent-subtle border border-accent/30 px-4 py-2.5 text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ content, index }: { content: string; index: number }) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMd() {
    downloadFile(`prompt-${index + 1}.md`, content, "text/markdown");
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] w-full">
        <div className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-foreground/85">
          <MarkdownMessage content={content} />
        </div>
        {/* Message-level actions: copying the whole reply is the primary move and
            must exist even when the reply has no fenced prompt block. */}
        <div className="mt-1.5 flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={copyAll}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopiert" : "Antwort kopieren"}
          </Button>
          <Button size="sm" variant="ghost" onClick={exportMd}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}

// Render an assistant reply as real Markdown — headings, lists, bold, tables —
// instead of raw text. Any fenced block becomes a CodeBlock with its own copy
// button, which is where the paste-ready prompt lives.
function MarkdownMessage({ content }: { content: string }) {
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
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-black/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/40">
          Prompt
        </span>
        <button
          type="button"
          onClick={copy}
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

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5">
        <DolphinLoader size={30} label="Schreibt…" />
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  Copy,
  Check,
  Download,
  Package,
  BookmarkPlus,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { AnimatedMascot } from "@/components/brand/animated-mascot";
import { DolphinLoader } from "@/components/brand/dolphin-loader";
import { PacketBridge } from "@/components/app/packet-bridge";
import { PromptSave } from "@/components/app/prompt-save";
import { DEFAULT_TOOLS, type ProjectTools } from "@/lib/tools";
import { downloadFile } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

// There is one chat (REDESIGN.md, Phase 2) — no mode choice at the start. The
// `mode` prop survives as an internal value (legacy conversations carry it, and
// the API picks its system prompt from it), but the empty state is identical
// for both stored modes. Only refining a project's packet is its own context.
type Variant = "general" | "software" | "refine";

const UNIFIED_EMPTY = {
  heading: "Woran arbeiten wir?",
  sub: "Beschreib dein Ziel — ein Text, ein Lernplan, eine ganze Software-Idee. Ich bau dir den fertigen Prompt und verfeinere ihn mit dir.",
  starters: [
    "Schreib mir einen Prompt für ein professionelles Bewerbungsschreiben.",
    "Ich brauche einen Prompt, der mir einen Lernplan für meine Prüfung erstellt.",
    "Ich hab eine App-Idee — bau mir das komplette Prompt-Paket dafür.",
  ],
};

const VARIANTS: Record<Variant, { heading: string; sub: string; starters: string[] }> = {
  general: UNIFIED_EMPTY,
  // Legacy mode value on old conversations; the chat experience is one.
  software: UNIFIED_EMPTY,
  refine: {
    heading: "Pass deine Prompts an",
    sub: "Sag mir, was ich an deinen Prompts ändern soll. Du bekommst die aktualisierte, fertige Version zurück.",
    // Unused directly — refine's starters depend on the project's own mode
    // (software vs. general), see REFINE_STARTERS below. Kept here only so
    // every Variant has the same shape; VARIANTS[variant] below never reads it.
    starters: [],
  },
};

// A project chat before any result exists: nothing to refine yet — the chat
// is where the project's first work happens, briefed by the context rail.
const PROJECT_FRESH = {
  heading: "Woran arbeiten wir hier?",
  sub: "Dieser Chat kennt dein Projekt — Anweisungen und Struktur aus der Seitenleiste fließen automatisch ein.",
  starters: [
    "Stell mir Fragen, die mein Briefing schärfen.",
    "Bau mir einen ersten Prompt aus meinem Projektkontext.",
    "Hilf mir zu planen, was dieses Projekt braucht.",
  ],
};

// The refine variant collapses mode away (see `variant` below), but its
// starter suggestions must still match what the project actually is — a
// Prompt-Projekt has no Frontend-/Backend-/Datenbank-Anteil to reference.
const REFINE_STARTERS: Record<"general" | "software", string[]> = {
  software: [
    "Mach den Master-Prompt kürzer und prägnanter.",
    "Ergänze den Frontend-Prompt um einen Dark-Mode.",
    "Erkläre das Datenbank-Schema mit mehr Kommentaren.",
  ],
  general: [
    "Mach den Haupt-Prompt kürzer und direkter.",
    "Passe den Ton an — freundlicher und weniger formell.",
    "Ergänze ein konkretes Beispiel für die gewünschte Ausgabe.",
  ],
};

export function Chat({
  mode,
  target,
  projectId,
  projectName,
  projectInstructions,
  projectContext,
  initialMessages,
  initialConversationId,
  defaultTools,
  hasResults = false,
}: {
  /** Internal system-prompt selector; legacy conversations may carry "software". */
  mode: "general" | "software";
  target?: string;
  projectId?: string;
  /** The workspace's own name — used by the handoff instead of re-asking. */
  projectName?: string;
  /** The workspace's Anweisungen — prefixed into the handoff's idea prefill. */
  projectInstructions?: string | null;
  /** The workspace's Struktur fields — prefill the handoff's tools/target. */
  projectContext?: Record<string, string>;
  initialMessages?: Msg[];
  initialConversationId?: string;
  /** Per-user tool defaults for the packet handoff. */
  defaultTools?: ProjectTools;
  /** For project chats: whether saved results exist (drives the empty-state copy). */
  hasResults?: boolean;
}) {
  // A project chat is its own context; every standalone chat is the one
  // unified chat. Inside a project the copy depends on whether results exist:
  // refining a saved packet/prompt vs. doing the project's first work. The
  // refine starters additionally need the underlying mode, since "refine"
  // alone doesn't say whether this is a software packet or a saved prompt.
  const variant: Variant = projectId ? "refine" : mode;
  const empty =
    variant === "refine" ? (hasResults ? VARIANTS.refine : PROJECT_FRESH) : VARIANTS[variant];
  const { heading, sub } = empty;
  const starters =
    variant === "refine"
      ? hasResults
        ? REFINE_STARTERS[mode]
        : PROJECT_FRESH.starters
      : VARIANTS[variant].starters;

  const placeholder =
    variant === "refine" && hasResults
      ? "Sag mir, was ich ändern soll…"
      : "Beschreib, woran wir arbeiten…";

  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While the packet/save handoff card is open, the transcript condenses to a
  // context strip and the composer hides — the card is the one thing on stage.
  const [handoffOpen, setHandoffOpen] = useState(false);
  // Which handoff card is on stage. The strip below offers both: saving the
  // prompt or building the full software packet — the outcome is a choice at
  // the end of a chat, no longer a mode picked at the start.
  const [handoff, setHandoff] = useState<"none" | "packet" | "save">("none");
  // Two scroll anchors: the bottom of the thread (used while a turn is in
  // flight, so the user sees their message + the typing indicator clear the
  // sticky composer) and the top of the latest result (used once the reply
  // lands, so a long result opens at its start — you read a prompt top-down).
  const endRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // The handoff appears once there's a real exchange worth keeping — inside a
  // project too: that's the workspace's actual production path (REDESIGN.md
  // — Handoff im Workspace). A standalone chat hands off into a brand-new
  // project; a project chat generates directly into the one it already lives
  // in, whether that's its first result or a fresh regeneration.
  const hasAssistantReply = messages.some((m) => m.role === "assistant");
  const canHandoff = hasAssistantReply;
  const isWorkspace = Boolean(projectId);

  // Inside a project, prefill the packet's tools / the prompt's target from
  // the workspace's own Struktur before falling back to the user's account
  // defaults — the project already knows more than the account does.
  const workspaceTools: ProjectTools | undefined = isWorkspace
    ? {
        master: projectContext?.target || defaultTools?.master || DEFAULT_TOOLS.master,
        frontend: projectContext?.frontend || defaultTools?.frontend || DEFAULT_TOOLS.frontend,
        backend: projectContext?.backend || defaultTools?.backend || DEFAULT_TOOLS.backend,
        database: projectContext?.database || defaultTools?.database || DEFAULT_TOOLS.database,
      }
    : undefined;
  const workspaceTarget = isWorkspace ? (projectContext?.target ?? target) : target;

  function closeHandoff() {
    setHandoff("none");
    setHandoffOpen(false);
  }

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (loading || last?.role === "user") {
      // Awaiting a reply — keep the newest turn + typing indicator in view.
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (last?.role === "assistant") {
      // Reply landed — bring the top of the fresh result into view.
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
      // onto it so every following turn appends to the same stored chat. That
      // first turn moves a fresh chat onto its canonical URL — /chats/[id] for
      // global chats, the project subroute for workspace chats — and refreshes
      // the server components so sidebar recents + project chat lists pick it up.
      if (json.conversationId) {
        const id = json.conversationId as string;
        if (!conversationId) {
          if (!initialConversationId) {
            router.replace(
              projectId ? `/projects/${projectId}/chats/${id}` : `/chats/${id}`,
              { scroll: false }
            );
          }
          router.refresh();
        }
        setConversationId(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  // The latest assistant reply is the current result — in the refine loop
  // every turn returns the updated, finished version, so "newest assistant
  // message" is always the thing to read. It gets promoted to a first-class
  // result panel; earlier turns stay a light conversation thread above it.
  const lastAssistantIndex = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1
  );

  return (
    <div className="flex flex-col gap-5">
      {messages.length === 0 ? (
        <EmptyState
          heading={heading}
          sub={sub}
          starters={starters}
          onPick={(t) => send(t)}
          disabled={loading}
        />
      ) : handoffOpen ? (
        // A handoff card is on stage — the transcript condenses to a slim,
        // non-scrolling context strip so nothing competes with the card.
        <ConversationStrip count={messages.length} />
      ) : (
        // role="log" + aria-live: screen readers announce new replies as they
        // arrive without moving focus out of the input. The whole page scrolls;
        // there is no inner scroller anymore.
        <div role="log" aria-live="polite" className="flex flex-col gap-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <UserBubble key={i} content={m.content} />
            ) : i === lastAssistantIndex ? (
              <div key={i} ref={resultRef} className="scroll-mt-24">
                <ResultPanel
                  content={m.content}
                  index={i}
                  showHandoff={canHandoff && handoff === "none"}
                  isWorkspace={isWorkspace}
                  onBuildPacket={() => setHandoff("packet")}
                  onSavePrompt={() => setHandoff("save")}
                />
              </div>
            ) : (
              <AssistantBubble key={i} content={m.content} index={i} />
            )
          )}
          {loading && <Typing />}
          <div ref={endRef} className="h-0 scroll-mb-32" />
        </div>
      )}

      {canHandoff && handoff === "packet" && (
        <PacketBridge
          autoOpen
          userMessages={messages.filter((m) => m.role === "user").map((m) => m.content)}
          defaultTools={workspaceTools ?? defaultTools ?? DEFAULT_TOOLS}
          conversationId={conversationId}
          onOpenChange={setHandoffOpen}
          onBack={closeHandoff}
          existingProjectId={projectId}
          projectName={projectName}
          projectInstructions={projectInstructions ?? undefined}
        />
      )}

      {canHandoff && handoff === "save" && (
        <PromptSave
          autoOpen
          userMessages={messages.filter((m) => m.role === "user").map((m) => m.content)}
          initialTarget={workspaceTarget}
          conversationId={conversationId}
          onOpenChange={setHandoffOpen}
          onBack={closeHandoff}
          existingProjectId={projectId}
          projectName={projectName}
          projectInstructions={projectInstructions ?? undefined}
        />
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          {error}
        </div>
      )}

      {!handoffOpen && (
        // The composer is subordinate to the result but always reachable: it
        // sticks to the bottom of the viewport while the page scrolls, with a
        // fade so the thread dissolves into it instead of colliding.
        <div className="sticky bottom-0 z-10 -mb-4 bg-gradient-to-t from-background via-background to-background/0 pb-4 pt-5">
          <div className="rounded-2xl border border-border-strong bg-surface-raised p-2.5">
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
              className="min-h-[56px] resize-none border-0 bg-transparent px-2 focus:ring-0"
            />
            <div className="mt-1 flex items-center justify-between gap-3 pl-2">
              <p className="hidden text-[11px] text-foreground/35 sm:block">
                Enter sendet · Shift+Enter neue Zeile · wird automatisch gespeichert.
              </p>
              <Button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="ml-auto shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Senden
              </Button>
            </div>
          </div>
        </div>
      )}
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
    <div className="flex min-h-[58vh] flex-col items-center justify-center py-10 text-center">
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

// The current result, first-class: a document-like panel (not a chat bubble)
// that carries the newest assistant reply. Reading is calm and full-width; the
// actions that belong to a result all live on it — copy/export in the header,
// the packet/save handoff as its footer — so nothing competes below it.
function ResultPanel({
  content,
  index,
  showHandoff,
  isWorkspace,
  onBuildPacket,
  onSavePrompt,
}: {
  content: string;
  index: number;
  showHandoff: boolean;
  isWorkspace: boolean;
  onBuildPacket: () => void;
  onSavePrompt: () => void;
}) {
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
    <section
      aria-label="Aktuelles Ergebnis"
      className="overflow-hidden rounded-2xl border border-border-strong bg-surface-raised"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 md:px-7">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-text" />
          <span className="text-[13px] font-medium text-foreground/75">Dein Ergebnis</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={copyAll}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopiert" : "Kopieren"}
          </Button>
          <Button size="sm" variant="ghost" onClick={exportMd}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </header>

      {/* Larger, looser type than a chat bubble — this is meant to be read. */}
      <div className="px-5 py-5 text-[14px] leading-[1.7] text-foreground/90 md:px-7 md:py-6">
        <MarkdownMessage content={content} />
      </div>

      {showHandoff && (
        <div className="flex flex-col gap-3 border-t border-border bg-surface px-5 py-3.5 md:px-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-foreground/70">
            {isWorkspace ? "Bereit, das als Ergebnis zu sichern?" : "Zufrieden? Dann heb dir das Ergebnis auf."}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onBuildPacket}>
              <Package className="h-4 w-4" />
              {isWorkspace ? "Software-Paket erzeugen" : "Software-Paket bauen"}
            </Button>
            <Button size="sm" variant="accent" onClick={onSavePrompt}>
              <BookmarkPlus className="h-4 w-4" />
              {isWorkspace ? "Prompt erzeugen" : "Prompt speichern"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// Shown in place of the transcript while a handoff card is on stage: a single
// quiet line so the card is unmistakably the one thing to act on.
function ConversationStrip({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-[12.5px] text-foreground/55">
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      Dein Chat · {count} {count === 1 ? "Nachricht" : "Nachrichten"}
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

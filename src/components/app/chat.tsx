"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PacketBridge } from "@/components/app/packet-bridge";
import { PromptSave } from "@/components/app/prompt-save";
import { ChatEmptyState } from "@/components/app/chat-empty-state";
import { ChatResultPanel } from "@/components/app/chat-result-panel";
import {
  ChatUserBubble,
  ChatAssistantBubble,
  ChatConversationStrip,
  ChatTyping,
} from "@/components/app/chat-transcript";
import { ChatComposer } from "@/components/app/chat-composer";
import { resolveVariant, resolveEmptyState, type ChatMode } from "@/lib/chat-variants";
import { DEFAULT_TOOLS, type ProjectTools } from "@/lib/tools";

type Msg = { role: "user" | "assistant"; content: string };

// Orchestrator only — every UI role that used to live inline here now has its
// own file (chat-empty-state, chat-result-panel, chat-transcript,
// chat-composer, chat-handoff-menu, chat-markdown; the variant/empty-state
// data lives in lib/chat-variants.ts). This component owns the actual chat
// state (transcript, in-flight send, handoff choice) and composes the pieces
// — a UX change to, say, the composer no longer risks touching markdown
// rendering or the empty-state copy along the way.
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
  mode: ChatMode;
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
  // unified chat. See lib/chat-variants.ts for what each variant means.
  const variant = resolveVariant(mode, projectId);
  const { heading, sub, starters, placeholder } = resolveEmptyState(variant, mode, hasResults);

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

  // Every field both handoff cards need — only what's specific to a software
  // packet (tools) vs. a general prompt (target) stays on each JSX call below,
  // instead of this component repeating the same eight prop names twice.
  const handoffProps = {
    autoOpen: true as const,
    userMessages: messages.filter((m) => m.role === "user").map((m) => m.content),
    conversationId,
    onOpenChange: setHandoffOpen,
    onBack: closeHandoff,
    existingProjectId: projectId,
    projectName,
    projectInstructions: projectInstructions ?? undefined,
  };

  return (
    <div className="flex flex-col gap-5">
      {messages.length === 0 ? (
        <ChatEmptyState
          heading={heading}
          sub={sub}
          starters={starters}
          onPick={(t) => send(t)}
          disabled={loading}
        />
      ) : handoffOpen ? (
        // A handoff card is on stage — the transcript condenses to a slim,
        // non-scrolling context strip so nothing competes with the card.
        <ChatConversationStrip count={messages.length} />
      ) : (
        // role="log" + aria-live: screen readers announce new replies as they
        // arrive without moving focus out of the input. The whole page scrolls;
        // there is no inner scroller anymore.
        <div role="log" aria-live="polite" className="flex flex-col gap-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <ChatUserBubble key={i} content={m.content} />
            ) : i === lastAssistantIndex ? (
              <div key={i} ref={resultRef} className="scroll-mt-24">
                <ChatResultPanel content={m.content} />
              </div>
            ) : (
              <ChatAssistantBubble key={i} content={m.content} index={i} />
            )
          )}
          {loading && <ChatTyping />}
          <div ref={endRef} className="h-0 scroll-mb-32" />
        </div>
      )}

      {canHandoff && handoff === "packet" && (
        <PacketBridge {...handoffProps} defaultTools={workspaceTools ?? defaultTools ?? DEFAULT_TOOLS} />
      )}

      {canHandoff && handoff === "save" && (
        <PromptSave {...handoffProps} initialTarget={workspaceTarget} />
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
        <ChatComposer
          input={input}
          onInputChange={setInput}
          placeholder={placeholder}
          loading={loading}
          onSend={() => send()}
          canHandoff={canHandoff}
          isWorkspace={isWorkspace}
          onHandoffSave={() => setHandoff("save")}
          onHandoffPacket={() => setHandoff("packet")}
        />
      )}
    </div>
  );
}

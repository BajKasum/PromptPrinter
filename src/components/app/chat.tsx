"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatEmptyState } from "@/components/app/chat-empty-state";
import { ChatResultPanel } from "@/components/app/chat-result-panel";
import { ChatUserBubble, ChatAssistantBubble, ChatTyping } from "@/components/app/chat-transcript";
import { ChatComposer } from "@/components/app/chat-composer";
import { MarkdownMessage } from "@/components/app/chat-markdown";
import { resolveVariant, resolveEmptyState, type ChatMode } from "@/lib/chat-variants";
import { parseSseEvents } from "@/lib/sse-stream";

// A stable id per message (real DB id for history loaded from the server,
// a client-generated one for anything created during this session) is the
// React key below, an always-appending list would tolerate the array index
// too, but a stable id survives if the transcript is ever edited/trimmed.
type Msg = { id: string; role: "user" | "assistant"; content: string };

// Orchestrator only, every UI role that used to live inline here now has its
// own file (chat-empty-state, chat-result-panel, chat-transcript,
// chat-composer, chat-markdown; the variant/empty-state data lives in
// lib/chat-variants.ts). This component owns the actual chat state
// (transcript, in-flight send) and composes the pieces, a UX change to, say,
// the composer no longer risks touching markdown rendering or the
// empty-state copy along the way.
export function Chat({
  mode,
  target,
  projectId,
  initialMessages,
  initialConversationId,
  hasResults = false,
  name,
}: {
  /** Internal system-prompt selector; legacy conversations may carry "software". */
  mode: ChatMode;
  target?: string;
  projectId?: string;
  initialMessages?: Msg[];
  initialConversationId?: string;
  /** For project chats: whether saved results exist (drives the empty-state copy). */
  hasResults?: boolean;
  /** The user's display name, personalizes the unified empty-state greeting. */
  name?: string | null;
}) {
  // A project chat is its own context; every standalone chat is the one
  // unified chat. See lib/chat-variants.ts for what each variant means.
  const variant = resolveVariant(mode, projectId);
  const { heading, placeholder } = resolveEmptyState(variant, hasResults, name);

  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the route replied but couldn't persist the turn (json.persistError):
  // the message is shown, but nothing was saved, so a reload loses it. Distinct
  // from `error` (which means no reply at all) since this must not block the
  // user from continuing to chat, only warn them the history isn't safe yet.
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  // The reply currently arriving via SSE, null when nothing is streaming.
  // Once the "done" event lands, its accumulated text is committed into
  // `messages` and this resets to null, see send() below.
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  // Two scroll anchors: the bottom of the thread (used while a turn is in
  // flight, so the user sees their message + the typing indicator clear the
  // sticky composer) and the top of the latest result (used once the reply
  // lands, so a long result opens at its start, you read a prompt top-down).
  const endRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  // The in-flight request's controller, so stop() (below) can abort it.
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (loading || streamingReply !== null || last?.role === "user") {
      // Awaiting/receiving a reply, keep the newest turn + typing indicator
      // (or the reply as it grows) in view.
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (last?.role === "assistant") {
      // Reply landed, bring the top of the fresh result into view.
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages, loading, streamingReply]);

  function stop() {
    abortControllerRef.current?.abort();
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { id: crypto.randomUUID(), role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setPersistWarning(null);
    setStreamingReply(null);
    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // The route streams the reply as "delta" events (see /api/chat), a local
    // accumulator rather than reading `streamingReply` back: state updates
    // are async, this loop needs the exact running text on every iteration,
    // not whatever last rendered, and the abort branch below needs whatever
    // arrived so far too.
    let accumulated = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, target, conversationId, projectId, messages: next }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        throw new Error((json.detail as string | undefined) ?? "Chat fehlgeschlagen");
      }
      if (!res.body) throw new Error("Keine Antwort erhalten.");

      for await (const { event, data } of parseSseEvents(res.body)) {
        if (event === "delta") {
          const { text: chunk } = JSON.parse(data) as { text: string };
          accumulated += chunk;
          setStreamingReply(accumulated);
        } else if (event === "error") {
          const { detail } = JSON.parse(data) as { detail: string };
          throw new Error(detail);
        } else if (event === "done") {
          const { conversationId: newId, persistError } = JSON.parse(data) as {
            conversationId?: string;
            persistError?: string;
          };
          setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: accumulated }]);
          // The route returns the conversation id on the first persisted turn;
          // hold onto it so every following turn appends to the same stored
          // chat. That first turn moves a fresh chat onto its canonical URL,
          // /chats/[id] for global chats, the project subroute for workspace
          // chats, and refreshes the server components so sidebar recents +
          // project chat lists pick it up.
          if (newId) {
            if (!conversationId) {
              if (!initialConversationId) {
                router.replace(
                  projectId ? `/projects/${projectId}/chats/${newId}` : `/chats/${newId}`,
                  { scroll: false }
                );
              }
              router.refresh();
            }
            setConversationId(newId);
          }
          if (persistError) {
            setPersistWarning(
              "Diese Antwort ist da, konnte aber gerade nicht gespeichert werden, bei einem Neuladen geht sie verloren."
            );
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // User-initiated stop, not a real failure: keep whatever text had
        // already streamed in as the committed reply instead of discarding
        // it (the route does the same server-side, best-effort persisting
        // the same partial text, see /api/chat).
        if (accumulated.trim()) {
          setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: accumulated }]);
        }
      } else {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    } finally {
      setStreamingReply(null);
      setLoading(false);
    }
  }

  // The latest assistant reply is the current result, in the refine loop
  // every turn returns the updated, finished version, so "newest assistant
  // message" is always the thing to read. It gets promoted to a first-class
  // result panel; earlier turns stay a light conversation thread above it.
  const lastAssistantIndex = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1
  );

  return (
    <div className="flex flex-col gap-5">
      {/* min-h keeps this area (and the composer right below it) roughly the
          same height whether it's showing the empty state or a short first
          exchange, otherwise the composer visibly jumps up the moment the
          empty state's own min-height goes away after the first reply. */}
      <div className="min-h-[58vh]">
        {messages.length === 0 ? (
          <ChatEmptyState heading={heading} />
        ) : (
          // role="log" + aria-live: screen readers announce new replies as they
          // arrive without moving focus out of the input. The whole page scrolls;
          // there is no inner scroller anymore.
          <div role="log" aria-live="polite" className="flex flex-col gap-6">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <ChatUserBubble key={m.id} content={m.content} />
              ) : i === lastAssistantIndex ? (
                <div key={m.id} ref={resultRef} className="scroll-mt-24">
                  <ChatResultPanel content={m.content} projectId={projectId} target={target} />
                </div>
              ) : (
                <ChatAssistantBubble key={m.id} content={m.content} index={i} />
              )
            )}
            {loading && streamingReply === null && <ChatTyping />}
            {streamingReply !== null && (
              // Plain preview bubble, not the featured ChatResultPanel: while
              // text is still arriving there's nothing sensible to copy/save
              // yet. Once "done" commits it into `messages`, the very same
              // content re-renders through the real ChatResultPanel above.
              <div className="flex justify-start">
                <div className="max-w-[88%] w-full rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-foreground/85">
                  <MarkdownMessage content={streamingReply} />
                </div>
              </div>
            )}
            <div ref={endRef} className="h-0 scroll-mb-32" />
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

      {persistWarning && (
        <div
          role="status"
          className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning"
        >
          {persistWarning}
        </div>
      )}

      <ChatComposer
        input={input}
        onInputChange={setInput}
        placeholder={placeholder}
        loading={loading}
        onSend={() => send()}
        onStop={stop}
      />
    </div>
  );
}

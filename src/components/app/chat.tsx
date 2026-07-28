"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChatEmptyState } from "@/components/app/chat-empty-state";
import { ChatResultPanel } from "@/components/app/chat-result-panel";
import {
  ChatUserBubble,
  ChatAssistantBubble,
  ChatTyping,
  ChatStreamingReply,
  ChatFinishedMarker,
} from "@/components/app/chat-transcript";
import { ChatComposer } from "@/components/app/chat-composer";
import { resolveVariant, resolveEmptyState, type ChatMode } from "@/lib/chat-variants";
import { parseSseEvents } from "@/lib/sse-stream";
import { MAX_TRANSCRIPT_MESSAGES } from "@/lib/chat-limits";

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
  // The reply currently arriving via SSE (raw accumulated text), plus whether
  // the stream has closed. It is deliberately NOT committed into `messages`
  // the moment "done" lands: ChatStreamingReply writes the text out at a
  // readable pace and calls back when it has caught up, and only then does the
  // turn become a real message. Committing on "done" instead made the tail of
  // a long prompt appear in one block exactly when the user was watching for
  // it to finish.
  const [pending, setPending] = useState<{ text: string; complete: boolean } | null>(null);
  // Mirrors `pending` for event handlers (stop()) and for the commit guard;
  // synced in an effect rather than assigned during render.
  const pendingRef = useRef<{ text: string; complete: boolean } | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  // True from the moment a reply finished writing until the next turn starts,
  // drives the celebrating end-of-turn marker. Starts false on a reloaded
  // chat: the marker celebrates a reply you just watched arrive, not every
  // page view of an old one.
  const [justFinished, setJustFinished] = useState(false);
  // Two scroll anchors: the bottom of the thread (used while a turn is in
  // flight, so the user sees their message + the typing indicator clear the
  // sticky composer) and the top of the latest result (used once the reply
  // lands, so a long result opens at its start, you read a prompt top-down).
  const endRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  // The in-flight request's controller, so stop() (below) can abort it.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Busy covers both halves of a turn: the request itself, and the stretch
  // afterwards where the text is still being written out. The composer stays
  // in "stop" mode for both, so a reply can't be interrupted by a new one
  // halfway through appearing.
  const busy = loading || pending !== null;

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (busy || last?.role === "user") {
      // Awaiting/receiving a reply, keep the newest turn + typing indicator
      // (or the reply as it grows) in view.
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (last?.role === "assistant") {
      // Reply landed, bring the top of the fresh result into view.
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages, busy, pending]);

  // Turn the in-flight reply into a real message. Idempotent via pendingRef:
  // the reveal's own callback and a stop() click can both reach here for the
  // same reply, and the second one must not append it twice. The text comes in
  // as an argument rather than off the ref, since child effects run before the
  // parent's ref-sync effect and the ref can be one commit stale.
  const commitReply = useCallback((text: string, celebrate = true) => {
    if (pendingRef.current === null) return;
    pendingRef.current = null;
    setPending(null);
    if (!text.trim()) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: text }]);
    if (celebrate) setJustFinished(true);
  }, []);

  function stop() {
    abortControllerRef.current?.abort();
    // The request may already be done and only the writing still running (the
    // stop button stays up for that too). Nothing left to abort in that case,
    // so show the rest at once instead. No celebration: the user cut it short.
    const p = pendingRef.current;
    if (p?.complete) commitReply(p.text, false);
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { id: crypto.randomUUID(), role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setPersistWarning(null);
    setPending(null);
    pendingRef.current = null;
    setJustFinished(false);
    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    // The route streams the reply as "delta" events (see /api/chat), a local
    // accumulator rather than reading `streamingReply` back: state updates
    // are async, this loop needs the exact running text on every iteration,
    // not whatever last rendered, and the abort branch below needs whatever
    // arrived so far too.
    let accumulated = "";
    // `messages` stays complete for the transcript on screen; only the newest
    // turns go over the wire. The route forwards just the last 12 to the model
    // and clamps anything longer than this itself, so replaying the full
    // history was pure payload — a long chat sent hundreds of KB per turn to
    // have most of it discarded server-side.
    const wireMessages =
      next.length > MAX_TRANSCRIPT_MESSAGES ? next.slice(-MAX_TRANSCRIPT_MESSAGES) : next;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, target, conversationId, projectId, messages: wireMessages }),
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
          setPending({ text: accumulated, complete: false });
        } else if (event === "error") {
          const { detail } = JSON.parse(data) as { detail: string };
          throw new Error(detail);
        } else if (event === "done") {
          const { conversationId: newId, persistError } = JSON.parse(data) as {
            conversationId?: string;
            persistError?: string;
          };
          // No text is coming any more; the reveal finishes writing what's
          // left and commits the message from its own callback.
          setPending({ text: accumulated, complete: true });
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
        // the same partial text, see /api/chat). No celebration for a reply
        // the user cut short; a no-op if stop() already committed it.
        commitReply(accumulated, false);
      } else {
        pendingRef.current = null;
        setPending(null);
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    } finally {
      // Only the request is over here. A completed reply that is still being
      // written out keeps `busy` true through `pending` until it commits.
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
      <div className="min-h-[58dvh]">
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
            {loading && pending === null && <ChatTyping />}
            {pending !== null && (
              <ChatStreamingReply
                text={pending.text}
                complete={pending.complete}
                onRevealed={commitReply}
              />
            )}
            {/* Only after the last character is written: the answer to "is it
                done, can I copy it now?". */}
            {justFinished && pending === null && <ChatFinishedMarker />}
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
        loading={busy}
        onSend={() => send()}
        onStop={stop}
      />
    </div>
  );
}

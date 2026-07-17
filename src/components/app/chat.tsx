"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatEmptyState } from "@/components/app/chat-empty-state";
import { ChatResultPanel } from "@/components/app/chat-result-panel";
import { ChatUserBubble, ChatAssistantBubble, ChatTyping } from "@/components/app/chat-transcript";
import { ChatComposer } from "@/components/app/chat-composer";
import { resolveVariant, resolveEmptyState, type ChatMode } from "@/lib/chat-variants";

type Msg = { role: "user" | "assistant"; content: string };

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
  // Two scroll anchors: the bottom of the thread (used while a turn is in
  // flight, so the user sees their message + the typing indicator clear the
  // sticky composer) and the top of the latest result (used once the reply
  // lands, so a long result opens at its start, you read a prompt top-down).
  const endRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (loading || last?.role === "user") {
      // Awaiting a reply, keep the newest turn + typing indicator in view.
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (last?.role === "assistant") {
      // Reply landed, bring the top of the fresh result into view.
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
      // first turn moves a fresh chat onto its canonical URL, /chats/[id] for
      // global chats, the project subroute for workspace chats, and refreshes
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
                <ChatUserBubble key={i} content={m.content} />
              ) : i === lastAssistantIndex ? (
                <div key={i} ref={resultRef} className="scroll-mt-24">
                  <ChatResultPanel content={m.content} projectId={projectId} target={target} />
                </div>
              ) : (
                <ChatAssistantBubble key={i} content={m.content} index={i} />
              )
            )}
            {loading && <ChatTyping />}
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

      <ChatComposer
        input={input}
        onInputChange={setInput}
        placeholder={placeholder}
        loading={loading}
        onSend={() => send()}
      />
    </div>
  );
}

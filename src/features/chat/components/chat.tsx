"use client";

import { useState } from "react";
import { ChatNotices } from "@/features/chat/components/chat-notices";
import { ChatThread } from "@/features/chat/components/chat-thread";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { VoiceBar } from "@/features/chat/components/voice-bar";
import { useAttachNotice } from "@/features/chat/hooks/use-attach-notice";
import { useChatScroll } from "@/features/chat/hooks/use-chat-scroll";
import { useChatTurn } from "@/features/chat/hooks/use-chat-turn";
import { resolveVariant, resolveEmptyState } from "@/features/chat/lib/chat-variants";
import type { Msg } from "@/features/chat/lib/chat-wire";
import { useT } from "@/shared/i18n/provider";

// Orchestrator only, every UI role that used to live inline here now has its
// own file (chat-empty-state, chat-result-panel, chat-transcript,
// chat-composer, chat-markdown; the variant/empty-state data lives in
// lib/chat-variants.ts). This component owns the actual chat state
// (transcript, in-flight send) and composes the pieces, a UX change to, say,
// the composer no longer risks touching markdown rendering or the
// empty-state copy along the way.
export function Chat({
  projectId,
  initialMessages,
  initialConversationId,
  hasResults = false,
  savedPrompts,
  name,
  needsKey = false,
}: {
  projectId?: string;
  initialMessages?: Msg[];
  initialConversationId?: string;
  /** For project chats: whether saved results exist (drives the empty-state copy). */
  hasResults?: boolean;
  /** Prompt text of every result already saved in this project (QA F-7: dedup without a migration). */
  savedPrompts?: string[];
  /** The user's display name, personalizes the unified empty-state greeting. */
  name?: string | null;
  /** Free without an own key: /api/chat will refuse, so say so up front (F-1). */
  needsKey?: boolean;
}) {
  // A project chat is its own context; every standalone chat is the one
  // unified chat. See lib/chat-variants.ts for what each variant means.
  const t = useT();
  const variant = resolveVariant(projectId);
  const { heading, placeholder } = resolveEmptyState(variant, hasResults, name, t.chat);


  const { attachments, attachNotice, clearAttachNotice, addFiles } = useAttachNotice();
  const turn = useChatTurn({
    projectId,
    initialMessages,
    initialConversationId,
    needsKey,
    attachments,
    clearAttachNotice,
  });
  const { messages, input, setInput, loading, busy, pending, justFinished, send, stop } = turn;
  const { endRef, resultRef } = useChatScroll({
    messages,
    busy,
    streamedChars: pending?.text.length ?? 0,
  });
  const [voiceOpen, setVoiceOpen] = useState(false);

  // The "taking a little longer" hint is NOT repeated here: its bubble
  // (DolphinLoader) is already a role="status" region, so it is announced from
  // there, and a second announcement of the same sentence would read it twice.
  //
  // What a screen reader actually needs to hear: that a reply started, and that
  // it finished — two discrete events, not the reply streaming in character by
  // character. The text itself stays readable at the user's own pace in the log
  // above (QA finding A-1).
  const liveStatus = loading
    ? t.chat.statusWriting
    : pending !== null
      ? t.chat.statusRevealing
      : justFinished
        ? t.chat.statusDone
        : "";

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatus}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveStatus}
      </div>
      <ChatThread
        messages={messages}
        heading={heading}
        busy={busy}
        loading={loading}
        pending={pending}
        retrying={turn.retrying}
        justFinished={justFinished}
        lastAssistantIndex={turn.lastAssistantIndex}
        projectId={projectId}
        savedPrompts={savedPrompts}
        resultRef={resultRef}
        endRef={endRef}
        onEdit={turn.editMessage}
        onRegenerate={turn.regenerate}
        onRevealed={turn.commitReply}
      />

      <ChatNotices
        keyRequired={turn.keyRequired}
        error={turn.error}
        retryAfter={turn.retryAfter}
        input={input}
        busy={busy}
        onResend={send}
        attachNotice={attachNotice}
        persistWarning={turn.persistWarning}
      />

      {/* Voice mode swaps in for the composer rather than covering the page:
          the transcript above stays visible and scrollable throughout, so
          talking to Finn never feels like leaving the chat. It runs the same
          turn through the same `send`, so a spoken conversation lands in this
          transcript and is persisted exactly like a typed one. */}
      {voiceOpen ? (
        <VoiceBar onClose={() => setVoiceOpen(false)} onSubmit={send} />
      ) : (
        <ChatComposer
          input={input}
          onInputChange={setInput}
          placeholder={placeholder}
          loading={busy}
          onSend={() => send()}
          onStop={stop}
          onVoice={() => setVoiceOpen(true)}
          attachments={attachments.items}
          attachPending={attachments.pending}
          onAddFiles={addFiles}
          onRemoveAttachment={attachments.remove}
        />
      )}
    </div>
  );
}

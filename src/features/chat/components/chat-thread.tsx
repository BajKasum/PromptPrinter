"use client";

import type { RefObject } from "react";
import { RotateCcw } from "lucide-react";
import { ChatEmptyState } from "@/features/chat/components/chat-empty-state";
import { ChatResultPanel } from "@/features/chat/components/chat-result-panel";
import {
  ChatUserBubble,
  ChatAssistantBubble,
  ChatTyping,
  ChatStreamingReply,
  ChatFinishedMarker,
} from "@/features/chat/components/chat-transcript";
import { UUID, type Msg } from "@/features/chat/lib/chat-wire";
import { useT } from "@/shared/i18n/provider";

// Der Verlauf eines Chats: Begruessung oder Nachrichten, die aktuelle Antwort als Ergebnis, laufende Antwort,
// "Neu erzeugen". Reine Darstellung, der Zustand steckt in useChatTurn. Aus chat.tsx herausgeloest (M7).
export function ChatThread({
  messages,
  heading,
  busy,
  loading,
  pending,
  retrying,
  justFinished,
  lastAssistantIndex,
  projectId,
  savedPrompts,
  resultRef,
  endRef,
  onEdit,
  onRegenerate,
  onRevealed,
}: {
  messages: Msg[];
  heading: string;
  busy: boolean;
  loading: boolean;
  pending: { text: string; complete: boolean } | null;
  retrying: boolean;
  justFinished: boolean;
  lastAssistantIndex: number;
  projectId?: string;
  savedPrompts?: string[];
  resultRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  onEdit: (id: string, next: string) => Promise<string | null>;
  onRegenerate: () => Promise<string | null>;
  onRevealed: (text: string, celebrate?: boolean) => void;
}) {
  const t = useT();
  // min-h keeps this area (and the composer right below it) roughly the
  // same height whether it's showing the empty state or a short first
  // exchange, otherwise the composer visibly jumps up the moment the
  // empty state's own min-height goes away after the first reply.
  return (
        <div className="min-h-[58dvh]">
          {messages.length === 0 ? (
            <ChatEmptyState heading={heading} />
          ) : (
            // role="log" WITHOUT a live region. It used to carry
            // aria-live="polite", which meant every text delta changed the
            // contents of a live region and screen readers re-announced the
            // growing reply token by token — unusable noise, on the one surface
            // that matters most here. Live regions are for finished status
            // messages, not for continuously growing text, so the announcements
            // moved to the dedicated status line below and this is just a
            // navigable log now.
            <div role="log" className="flex flex-col gap-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <ChatUserBubble
                    key={m.id}
                    content={m.content}
                    attachments={m.attachments}
                    // Kein Bearbeiten waehrend eines laufenden Zugs: die Frage
                    // umzuschreiben, auf die gerade geantwortet wird, ergaebe
                    // einen Verlauf, der nicht zusammenpasst. Auch nicht, wenn
                    // die Nachricht Anhaenge traegt und ihre echte Zeilen-ID noch
                    // nicht bekannt ist: ohne sie liessen sich die Dateien nicht
                    // an die neue Fassung umhaengen und gingen mit der alten
                    // verloren.
                    onEdit={
                      busy || (m.attachments?.length && !UUID.test(m.id))
                        ? undefined
                        : (next) => void onEdit(m.id, next)
                    }
                  />
                ) : i === lastAssistantIndex ? (
                  <div key={m.id} ref={resultRef} className="scroll-mt-24">
                    <ChatResultPanel
                      content={m.content}
                      projectId={projectId}
                      savedPrompts={savedPrompts}
                    />
                  </div>
                ) : (
                  <ChatAssistantBubble key={m.id} content={m.content} index={i} />
                )
              )}
              {loading && pending === null && <ChatTyping retrying={retrying} />}
              {pending !== null && (
                <ChatStreamingReply
                  text={pending.text}
                  complete={pending.complete}
                  onRevealed={onRevealed}
                />
              )}
              {/* Only after the last character is written: the answer to "is it
                  done, can I copy it now?". */}
              {justFinished && pending === null && <ChatFinishedMarker />}

              {/* Neu erzeugen (Planpunkt C-2). Sitzt unter der letzten Antwort,
                  weil es sich auf genau die bezieht — und nur im Ruhezustand,
                  damit es waehrend eines laufenden Zugs nicht mit dem
                  Stopp-Knopf im Composer konkurriert.

                  Fuer ein Werkzeug, dessen Versprechen "nicht Credits
                  verbrennen" ist, ist das der passende Weg zurueck: eine Antwort
                  nachschaerfen, ohne einen neuen Chat aufzumachen und den ganzen
                  Kontext noch einmal zu bezahlen. */}
              {lastAssistantIndex !== -1 && !busy && pending === null && (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => void onRegenerate()}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-secondary transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                    {t.chat.regenerate}
                  </button>
                </div>
              )}
              <div ref={endRef} className="h-0 scroll-mb-32" />
            </div>
          )}
        </div>
  );
}

"use client";

import { AnimatedMascot } from "@/shared/brand/animated-mascot";
import { PromptCopiedContext } from "@/features/chat/lib/prompt-copied";
import { MarkdownMessage } from "@/features/chat/components/chat-markdown";
import { ChatReplyActions } from "@/features/chat/components/chat-transcript";
import { RefineChips } from "@/features/chat/components/refine-chips";
import { PlaceholderForm } from "@/features/chat/components/placeholder-form";
import { SavePromptButton } from "@/features/chat/components/save-prompt-button";
import { PromptActions } from "@/features/chat/components/prompt-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractPrompt } from "@/shared/lib/saved-prompts";
import { useT } from "@/shared/i18n/provider";

// The current result, first-class: a document-like panel (not a chat bubble)
// that carries the newest assistant reply. Reading is calm and full-width.
// Copying the prompt stays on the prompt block itself (MarkdownMessage's
// CodeBlock); the header offers "Speichern" so a good prompt can be kept in the
// user's saved-prompt library, and the footer carries the same copy/export
// actions as an older reply (#150). The title follows the content: "Dein Prompt"
// once there is a prompt block, "Finns Antwort" for anything else, e.g. his
// follow-up question, which is not a result.
//
// QA finding N-1 (reworked, see save-prompt-button.tsx's own comment): used
// to require a projectId — a global chat had nowhere to save into. Saving is
// project-independent now, so this only needs an actual prompt to exist.
export function ChatResultPanel({
  content,
  projectId,
  savedPrompts,
  index = 0,
  typed,
  busy = false,
  onRefine,
  onRefineOther,
}: {
  content: string;
  /** Present for project chats; omitted (or null) for a global chat's save. */
  projectId?: string | null;
  /** Prompt text of every result already saved (project-scoped, or every one of this user's for a global chat). */
  savedPrompts?: string[];
  /** Position of the reply in the chat, names the export file the same way the older replies do. */
  index?: number;
  /** Was die Person im Gespräch geschrieben hat; schaltet die Prompt-Prüfung ein. */
  typed?: string;
  /** Während ein Zug läuft, bietet das Panel kein Verfeinern an. */
  busy?: boolean;
  /** Ein Tipp auf "Kürzer", "Förmlicher" ...: schickt die vorformulierte Nachricht (#245). */
  onRefine?: (message: string) => void;
  /** "Anderes": setzt nur den Cursor ins Eingabefeld. */
  onRefineOther?: () => void;
}) {
  const t = useT();
  const savablePrompt = extractPrompt(content);
  const alreadySaved = savablePrompt ? (savedPrompts?.includes(savablePrompt) ?? false) : false;
  // Sind Platzhalter ausgefüllt, nehmen Öffnen und Probelauf diese Fassung (gespeichert wird weiter die mit Platzhaltern).
  const [filled, setFilled] = useState<string | null>(null);
  // Finn am Ergebnis: denkt, solange ein Zug läuft, liefert beim fertigen Prompt und freut sich kurz nach dem Kopieren.
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPromptCopied = useCallback(() => {
    setCelebrating(true);
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrating(false), 2400);
  }, []);
  useEffect(() => () => {
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
  }, []);
  const finnState = busy ? "thinking" : celebrating ? "celebrating" : savablePrompt ? "delivering" : "explaining";

  return (
    <PromptCopiedContext.Provider value={onPromptCopied}>
    <section
      aria-label={t.chat.resultLabel}
      className="overflow-hidden rounded-2xl border border-border-strong bg-surface-raised"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-7">
        <div className="flex items-center gap-2">
          {/* Klein und ruhig: der Zustand wechselt, die Bewegung ist das sanfte Preset des Zustands und fällt bei
              reduzierter Bewegung weg (AnimatedMascot). */}
          <span data-testid="result-finn" data-state={finnState} className="shrink-0">
            <AnimatedMascot state={finnState} size={22} alt="" />
          </span>
          <span className="text-[13px] font-medium text-foreground/75">{savablePrompt ? t.chat.resultTitlePrompt : t.chat.resultTitleReply}</span>
        </div>
        {savablePrompt && (
          <SavePromptButton
            projectId={projectId}
            prompt={savablePrompt}
            initiallySaved={alreadySaved}
          />
        )}
      </header>

      {/* Larger, looser type than a chat bubble, this is meant to be read. */}
      <div className="px-3 py-4 text-[14px] leading-[1.7] text-foreground/90 md:px-7 md:py-6">
        <MarkdownMessage content={content} typed={typed} />
      </div>

      {savablePrompt && <PlaceholderForm key={savablePrompt} prompt={savablePrompt} onFilledChange={setFilled} />}

      {savablePrompt && <PromptActions key={savablePrompt} prompt={filled ?? savablePrompt} />}

      {/* Same actions as under an older reply (#150): the prompt that just got
          finished is the moment you most want to export it. */}
      <footer className="border-t border-border px-2 py-2 md:px-6">
        <ChatReplyActions content={content} index={index} />
      </footer>

      {savablePrompt && !busy && onRefine && onRefineOther && (
        <RefineChips onRefine={onRefine} onOther={onRefineOther} />
      )}
    </section>
    </PromptCopiedContext.Provider>
  );
}

"use client";

import { Mascot } from "@/shared/brand/mascot";
import { MarkdownMessage } from "@/features/chat/components/chat-markdown";
import { SavePromptButton } from "@/features/chat/components/save-prompt-button";
import { extractPrompt } from "@/shared/lib/saved-prompts";

// The current result, first-class: a document-like panel (not a chat bubble)
// that carries the newest assistant reply. Reading is calm and full-width,
// nothing but the result lives here. Copying stays on the prompt block itself
// (MarkdownMessage's CodeBlock); the header also offers "Speichern" so a good
// prompt can be kept in the user's saved-prompt library.
//
// QA finding N-1 (reworked, see save-prompt-button.tsx's own comment): used
// to require a projectId — a global chat had nowhere to save into. Saving is
// project-independent now, so this only needs an actual prompt to exist.
export function ChatResultPanel({
  content,
  projectId,
  target,
  savedPrompts,
}: {
  content: string;
  /** Present for project chats; omitted (or null) for a global chat's save. */
  projectId?: string | null;
  /** The chat's target AI, stored alongside a saved prompt. */
  target?: string | null;
  /** Prompt text of every result already saved (project-scoped, or every one of this user's for a global chat). */
  savedPrompts?: string[];
}) {
  const savablePrompt = extractPrompt(content);
  const alreadySaved = savablePrompt ? (savedPrompts?.includes(savablePrompt) ?? false) : false;

  return (
    <section
      aria-label="Aktuelles Ergebnis"
      className="overflow-hidden rounded-2xl border border-border-strong bg-surface-raised"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 md:px-7">
        <div className="flex items-center gap-2">
          {/* Finn's delivering pose, static, a quiet badge, not a performing
              character: this sits on screen for as long as you're reading. */}
          <Mascot state="delivering" size={22} className="shrink-0" />
          <span className="text-[13px] font-medium text-foreground/75">Dein Ergebnis</span>
        </div>
        {savablePrompt && (
          <SavePromptButton
            projectId={projectId}
            prompt={savablePrompt}
            target={target}
            initiallySaved={alreadySaved}
          />
        )}
      </header>

      {/* Larger, looser type than a chat bubble, this is meant to be read. */}
      <div className="px-5 py-5 text-[14px] leading-[1.7] text-foreground/90 md:px-7 md:py-6">
        <MarkdownMessage content={content} />
      </div>
    </section>
  );
}

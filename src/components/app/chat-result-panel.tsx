"use client";

import { Mascot } from "@/components/brand/mascot";
import { MarkdownMessage } from "@/components/app/chat-markdown";
import { SavePromptButton } from "@/components/app/save-prompt-button";
import { extractPrompt } from "@/lib/saved-prompts";

// The current result, first-class: a document-like panel (not a chat bubble)
// that carries the newest assistant reply. Reading is calm and full-width,
// nothing but the result lives here. Copying stays on the prompt block itself
// (MarkdownMessage's CodeBlock); inside a project chat the header also offers
// "Speichern" so a good prompt can be kept in the project's Ergebnisse. In a
// global chat (no projectId) there is nowhere to save into, so the button is
// simply absent.
export function ChatResultPanel({
  content,
  projectId,
  target,
}: {
  content: string;
  /** Present only for project chats, gates the save affordance. */
  projectId?: string;
  /** The chat's target AI, stored alongside a saved prompt. */
  target?: string | null;
}) {
  const savablePrompt = projectId ? extractPrompt(content) : null;

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
        {projectId && savablePrompt && (
          <SavePromptButton projectId={projectId} prompt={savablePrompt} target={target} />
        )}
      </header>

      {/* Larger, looser type than a chat bubble, this is meant to be read. */}
      <div className="px-5 py-5 text-[14px] leading-[1.7] text-foreground/90 md:px-7 md:py-6">
        <MarkdownMessage content={content} />
      </div>
    </section>
  );
}

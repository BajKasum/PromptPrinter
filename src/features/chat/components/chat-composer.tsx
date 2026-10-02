"use client";

import { useEffect, useRef } from "react";
import { AudioLines, Plus, Send, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/input";
import { Tooltip } from "@/shared/ui/tooltip";
import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_USER_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import { ATTACHMENT_ACCEPT } from "@/shared/lib/chat-attachments";
import { AttachmentTray } from "@/features/chat/components/attachment-chips";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import { useVisualViewportInset } from "@/features/chat/hooks/use-visual-viewport-inset";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

// Caps how tall the composer can grow before it scrolls internally instead,
// matches the Claude/ChatGPT feel: starts at one line, grows with content,
// never eats the whole viewport.
const MAX_TEXTAREA_HEIGHT = 200;

// The composer is subordinate to the result but always reachable: it sticks
// to the bottom of the viewport while the page scrolls, with a fade so the
// thread dissolves into it instead of colliding.
export function ChatComposer({
  input,
  onInputChange,
  placeholder,
  loading,
  onSend,
  onStop,
  onVoice,
  attachments = [],
  attachPending = 0,
  onAddFiles,
  onRemoveAttachment,
}: {
  input: string;
  onInputChange: (value: string) => void;
  placeholder: string;
  loading: boolean;
  onSend: () => void;
  /** Stops an in-flight reply (aborts the fetch), the composer's button switches to this while loading. */
  onStop: () => void;
  /** Opens voice mode. Omitted where there's no chat to talk to. */
  onVoice?: () => void;
  /** Photos and files waiting to go out with the next message. */
  attachments?: DraftAttachment[];
  /** Files still being prepared (resized, checked), each holds a slot and a placeholder. */
  attachPending?: number;
  /** Omitted where attachments aren't offered: no "+" button then. */
  onAddFiles?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
}) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // QA finding K-1: keeps the sticky composer pinned above an on-screen
  // keyboard on iOS Safari instead of floating mid-screen or hiding behind
  // it. 0 everywhere else (no keyboard open, no VisualViewport support).
  const keyboardInset = useVisualViewportInset();

  // The server rejects anything above this, and pasting a long spec or log into
  // the composer is exactly what this audience does. Without the cap that came
  // back as a bare "Invalid request" with no hint what went wrong, so the limit
  // is enforced where it can still be seen — and only announced once it's close
  // enough to matter, rather than sitting there as permanent chrome.
  const attachLimitReached = attachments.length + attachPending >= MAX_ATTACHMENTS_PER_MESSAGE;
  // A message needs its words: Finn is told what to do with the files by the
  // text, and the route stores a message with content. The hint under the
  // files says so, so a disabled send button isn't a puzzle.
  const needsText = attachments.length > 0 && !input.trim();
  const remaining = MAX_USER_MESSAGE_CHARS - input.length;
  const showRemaining = remaining <= MAX_USER_MESSAGE_CHARS * 0.1;

  // Auto-grow with content, one line at rest, up to MAX_TEXTAREA_HEIGHT, then
  // it scrolls internally. Re-measuring against "auto" first (rather than
  // just reading scrollHeight) is what lets it shrink back down too, e.g.
  // after sending clears the input.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  return (
    <div
      style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
      className="sticky bottom-0 z-10 -mb-4 bg-gradient-to-t from-background via-background to-background/0 pb-4 pt-5">
      <div className="relative rounded-2xl border border-border-strong bg-surface-raised">
        {onAddFiles && (
          <>
            {/* The picker itself. Hidden, opened by the "+" button below, and
                reset after every pick so choosing the same file twice (after
                removing it) still fires a change. */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              tabIndex={-1}
              aria-hidden="true"
              data-testid="attachment-input"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) onAddFiles(files);
              }}
            />
            <AttachmentTray
              items={attachments}
              pending={attachPending}
              onRemove={(id) => onRemoveAttachment?.(id)}
            />
            {needsText && (
              <p className="px-4 pt-1 text-[12px] leading-snug text-tertiary">{t.chat.attachHint}</p>
            )}
          </>
        )}
        <Textarea
          ref={textareaRef}
          rows={1}
          value={input}
          placeholder={placeholder}
          aria-label={t.chat.composerLabel}
          maxLength={MAX_USER_MESSAGE_CHARS}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          // A screenshot pasted from the clipboard is the quickest way to
          // attach one. Only intercepted when the clipboard really carries
          // files; pasting text keeps working exactly as before.
          onPaste={(e) => {
            if (!onAddFiles) return;
            const files = Array.from(e.clipboardData?.files ?? []);
            if (files.length === 0) return;
            e.preventDefault();
            onAddFiles(files);
          }}
          className={
            onAddFiles
              ? "min-h-[48px] max-h-[200px] resize-none overflow-y-auto border-0 bg-transparent py-3 pl-[3.25rem] pr-[5.5rem] transition-[height] duration-100 ease-out focus:ring-0"
              : "min-h-[48px] max-h-[200px] resize-none overflow-y-auto border-0 bg-transparent py-3 pl-4 pr-[5.5rem] transition-[height] duration-100 ease-out focus:ring-0"
          }
        />
        {onAddFiles && (
          // "+" opens the file picker directly, no menu: photos and files are
          // the only thing it does. The tooltip names the action, the button's
          // own aria-label carries the same words for screen readers.
          <Tooltip
            align="start"
            label={
              attachLimitReached
                ? fmt(t.chat.attachLimit, { max: MAX_ATTACHMENTS_PER_MESSAGE })
                : t.chat.attachAdd
            }
            className="absolute bottom-2 left-2"
          >
            <Button
              type="button"
              size="icon"
              variant="subtle"
              disabled={attachLimitReached}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t.chat.attachAdd}
              className="h-9 w-9 shrink-0 rounded-full"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Button>
          </Tooltip>
        )}
        {/* No permanent "Enter sendet…" hint here, Enter-to-send is a
            convention every chat app already teaches; repeating it on every
            single message would be chrome, not help. */}
        {showRemaining && (
          <span
            aria-live="polite"
            className={
              remaining === 0
                ? "pointer-events-none absolute bottom-3 right-24 text-[11px] tabular-nums text-destructive"
                : "pointer-events-none absolute bottom-3 right-24 text-[11px] tabular-nums text-muted-foreground"
            }
          >
            {remaining === 0
              ? t.chat.maxLengthReached
              : fmt(t.chat.charsLeft, { count: remaining })}
          </span>
        )}
        {/* Voice mode. Sits beside the send button rather than replacing it:
            both are ways to say the same thing and which one you want depends
            on where you are, not on what you've typed. Hidden while a reply is
            in flight, since voice mode drives that same request itself. */}
        {onVoice && !loading && (
          <Button
            onClick={onVoice}
            size="icon"
            variant="subtle"
            aria-label={t.chat.openVoice}
            title={t.chat.voiceTitle}
            className="absolute bottom-2 right-12 h-9 w-9 shrink-0 rounded-full"
          >
            <AudioLines className="h-4 w-4" strokeWidth={1.8} />
          </Button>
        )}
        {loading ? (
          <Button
            onClick={onStop}
            size="icon"
            variant="subtle"
            aria-label={t.chat.stop}
            className="absolute bottom-2 right-2 h-9 w-9 shrink-0 rounded-full"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={onSend}
            disabled={!input.trim() || attachPending > 0}
            size="icon"
            aria-label={t.chat.send}
            className="absolute bottom-2 right-2 h-9 w-9 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/* EU-KI-Verordnung Art. 50 Abs. 1, anwendbar seit 2. August 2026: wer
          mit einem KI-System spricht, muss das spaetestens bei der ersten
          Interaktion erfahren, ausser es ist offensichtlich. Ein Delfin als
          Maskottchen macht es nicht offensichtlich. Der Satz steht deshalb
          dauerhaft hier, also auch in der leeren Ansicht vor der ersten
          Nachricht, und ist bewusst keine "Enter sendet"-Chrome (siehe oben):
          er ist eine Pflichtangabe (Rechts-Audit 28.09.2026). */}
      <p className="mt-2 text-center text-[11.5px] leading-snug text-tertiary">
        {t.chat.aiDisclosure}
      </p>
    </div>
  );
}

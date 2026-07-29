"use client";

import { useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MAX_USER_MESSAGE_CHARS } from "@/lib/chat-limits";
import { TargetPicker } from "@/components/app/target-picker";
import { useVisualViewportInset } from "@/lib/use-visual-viewport-inset";

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
  target,
  onTargetChange,
}: {
  input: string;
  onInputChange: (value: string) => void;
  placeholder: string;
  loading: boolean;
  onSend: () => void;
  /** Stops an in-flight reply (aborts the fetch), the composer's button switches to this while loading. */
  onStop: () => void;
  /** The build tool the prompt is tailored for; undefined means "not specified". */
  target?: string;
  onTargetChange?: (next: string | undefined) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // QA finding K-1: keeps the sticky composer pinned above an on-screen
  // keyboard on iOS Safari instead of floating mid-screen or hiding behind
  // it. 0 everywhere else (no keyboard open, no VisualViewport support).
  const keyboardInset = useVisualViewportInset();

  // The server rejects anything above this, and pasting a long spec or log into
  // the composer is exactly what this audience does. Without the cap that came
  // back as a bare "Invalid request" with no hint what went wrong, so the limit
  // is enforced where it can still be seen — and only announced once it's close
  // enough to matter, rather than sitting there as permanent chrome.
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
      {/* Above the input, not inside it: it qualifies what gets written, so it
          belongs next to the writing, and it stays reachable in a chat that
          already has turns (an empty-state-only control would strand those). */}
      {onTargetChange && (
        <div className="mb-2">
          <TargetPicker value={target} onChange={onTargetChange} disabled={loading} />
        </div>
      )}
      <div className="relative rounded-2xl border border-border-strong bg-surface-raised">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={input}
          placeholder={placeholder}
          maxLength={MAX_USER_MESSAGE_CHARS}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="min-h-[48px] max-h-[200px] resize-none overflow-y-auto border-0 bg-transparent py-3 pl-4 pr-14 transition-[height] duration-100 ease-out focus:ring-0"
        />
        {/* No permanent "Enter sendet…" hint here, Enter-to-send is a
            convention every chat app already teaches; repeating it on every
            single message would be chrome, not help. */}
        {showRemaining && (
          <span
            aria-live="polite"
            className={
              remaining === 0
                ? "pointer-events-none absolute bottom-3 right-14 text-[11px] tabular-nums text-destructive"
                : "pointer-events-none absolute bottom-3 right-14 text-[11px] tabular-nums text-muted-foreground"
            }
          >
            {remaining === 0 ? "Maximale Länge erreicht" : `noch ${remaining} Zeichen`}
          </span>
        )}
        {loading ? (
          <Button
            onClick={onStop}
            size="icon"
            variant="subtle"
            aria-label="Generierung stoppen"
            className="absolute bottom-2 right-2 h-9 w-9 shrink-0 rounded-full"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={onSend}
            disabled={!input.trim()}
            size="icon"
            aria-label="Senden"
            className="absolute bottom-2 right-2 h-9 w-9 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

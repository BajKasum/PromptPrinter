"use client";

import { useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

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
}: {
  input: string;
  onInputChange: (value: string) => void;
  placeholder: string;
  loading: boolean;
  onSend: () => void;
  /** Stops an in-flight reply (aborts the fetch), the composer's button switches to this while loading. */
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="sticky bottom-0 z-10 -mb-4 bg-gradient-to-t from-background via-background to-background/0 pb-4 pt-5">
      <div className="relative rounded-2xl border border-border-strong bg-surface-raised">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={input}
          placeholder={placeholder}
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

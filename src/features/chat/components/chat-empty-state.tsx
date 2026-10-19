"use client";

import { AnimatedMascot } from "@/shared/brand/animated-mascot";

// Finn and his opening line, and, in a fresh standalone chat, a few ideas to
// tap (#156). A new user doesn't know the principle "first a question, then the
// prompt", and an empty field is where many stall. The ideas are phrased as
// "A prompt for ...", which shows both the range of the promise and how to
// word the first message. A tap fills the field, it never sends.
export function ChatEmptyState({
  heading,
  suggestionsLabel,
  suggestions,
  onPick,
}: {
  heading: string;
  suggestionsLabel?: string;
  suggestions?: readonly string[];
  onPick?: (text: string) => void;
}) {
  const showSuggestions = Boolean(onPick && suggestions && suggestions.length > 0);
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <AnimatedMascot state="curious" size={84} priority className="mx-auto mb-4" />
      <h2 className="text-[18px] font-semibold text-foreground">{heading}</h2>
      {showSuggestions && (
        <div className="mt-6 w-full max-w-xl">
          {suggestionsLabel && <p className="mb-2.5 text-[13px] text-tertiary">{suggestionsLabel}</p>}
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {suggestions!.map((text) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => onPick!(text)}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border bg-surface px-4 py-2 text-[14px] leading-snug text-secondary transition-colors hover:border-accent/40 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-auto"
                >
                  {text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

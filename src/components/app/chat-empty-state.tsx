"use client";

import { AnimatedMascot } from "@/components/brand/animated-mascot";

export function ChatEmptyState({
  heading,
  sub,
  starters,
  onPick,
  disabled,
}: {
  heading: string;
  sub: string;
  starters: string[];
  onPick: (t: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-h-[58vh] flex-col items-center justify-center py-10 text-center">
      {/* Finn greets you, curious to hear the idea you're about to describe. */}
      <AnimatedMascot state="curious" size={84} priority className="mx-auto mb-4" />
      <h2 className="text-[18px] font-semibold text-foreground">{heading}</h2>
      <p className="mt-1 text-[13px] text-foreground/55 max-w-sm">{sub}</p>
      <div className="mt-5 w-full max-w-md space-y-2">
        <p className="text-left text-[12px] text-foreground/45">Oder starte mit einem Beispiel:</p>
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="w-full text-left rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] text-foreground/75 hover:border-border-strong hover:bg-surface-hover hover:text-foreground active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

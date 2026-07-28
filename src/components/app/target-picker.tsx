"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_TARGET_LENGTH, TARGET_TOOLS, normalizeTarget } from "@/lib/target-tools";

// Picks the tool a prompt gets tailored for. Sits directly above the composer
// rather than in the empty state alone, so it is still reachable in a chat that
// already has turns — the case an empty-state-only control would strand.
//
// Compact by default (one small pill), because it is a qualifier for the input
// below it, not a step of its own. DESIGN.md rules out permanent chrome, and a
// row of eight brand tiles hovering over every chat would be exactly that.
export function TargetPicker({
  value,
  onChange,
  disabled = false,
}: {
  value?: string;
  onChange: (next: string | undefined) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — the same two gestures every other
  // popover in the app honours (see the account menu in sidebar.tsx).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string | undefined) {
    onChange(normalizeTarget(next));
    setOpen(false);
    setCustom("");
  }

  return (
    <div ref={containerRef} className="relative flex justify-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50",
          value
            ? "border-accent/40 bg-accent-subtle text-accent-text"
            : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
        )}
      >
        <Crosshair className="h-3 w-3" strokeWidth={2} />
        {value ? `Für ${value}` : "Ziel-Tool wählen"}
        <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Ziel-Tool"
          className="absolute bottom-full left-0 z-30 mb-2 w-64 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated"
        >
          <div className="border-b border-border px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Wofür soll der Prompt gebaut sein? Finn schneidet ihn dann auf die
            Eigenheiten dieses Tools zu.
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {TARGET_TOOLS.map((tool) => (
              <button
                key={tool}
                type="button"
                role="option"
                aria-selected={value === tool}
                onClick={() => pick(tool)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground/80 transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {tool}
                {value === tool && <Check className="h-3.5 w-3.5 text-accent-text" strokeWidth={2.2} />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2">
            {/* Free text on purpose: a new build tool appears every month and
                must not need a release here to be usable. */}
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  e.preventDefault();
                  pick(custom);
                }
              }}
              maxLength={MAX_TARGET_LENGTH}
              placeholder="oder anderes Tool eintippen"
              aria-label="Anderes Ziel-Tool"
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => pick(undefined)}
                className="mt-1.5 w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                Kein bestimmtes Tool
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

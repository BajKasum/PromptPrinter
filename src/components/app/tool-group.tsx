"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ToolGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  // Anything off the preset list is a custom entry the user typed themselves.
  const isCustom = !options.includes(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusNext = useRef(false);

  // Focus the free-text field the instant the user switches into custom mode,
  // but never on mount/step-return so it doesn't steal focus unprompted.
  useEffect(() => {
    if (isCustom && focusNext.current) {
      inputRef.current?.focus();
      focusNext.current = false;
    }
  }, [isCustom]);

  function pickCustom() {
    focusNext.current = true;
    if (isCustom) inputRef.current?.focus();
    else onChange(""); // clear the preset so the user types fresh
  }

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "h-10 px-3 rounded-lg text-[13px] font-medium transition-all border",
                active
                  ? "border-violet-500/55 bg-violet-500/10 text-white"
                  : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {opt}
            </button>
          );
        })}

        {/* Custom choice — fills the 4th column and reveals a free-text field. */}
        <button
          type="button"
          onClick={pickCustom}
          aria-pressed={isCustom}
          className={cn(
            "h-10 px-3 rounded-lg text-[13px] font-medium transition-all border",
            isCustom
              ? "border-violet-500/55 bg-violet-500/10 text-white"
              : "border-dashed border-white/15 bg-white/[0.01] text-white/55 hover:text-white hover:bg-white/[0.04]"
          )}
        >
          Eigenes
        </button>
      </div>

      {isCustom && (
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="z. B. Deepseek, MongoDB…"
          aria-label={`${label} — eigenes Tool`}
          maxLength={40}
          className="mt-2 h-10"
        />
      )}
    </div>
  );
}

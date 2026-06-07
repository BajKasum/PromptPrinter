"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToolLogo, toolVisual } from "@/components/brand/tool-logos";
import { cn } from "@/lib/utils";

/**
 * A category of build-target choices rendered as selectable product cards:
 * brand logo, blurb, hover-lift, a accent selected state and a spring-in
 * checkmark. The final card is always "Eigenes" — pick it to type a tool we
 * don't list (Deepseek, MongoDB, …) and the entry is stored verbatim.
 */
export function ToolPickerGroup({
  label,
  hint,
  Icon,
  accent,
  options,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  Icon: LucideIcon;
  accent: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  // Anything not in the preset list is a custom entry (including a stored value
  // like the now-retired "v0", which gracefully reappears as custom text).
  const isCustom = !options.includes(value);
  const customEmpty = isCustom && value.trim().length === 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const focusNext = useRef(false);

  // Focus the free-text field the instant the user switches into custom mode,
  // but never on mount — a saved custom value shouldn't steal focus on load.
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
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg border"
          style={{ backgroundColor: `${accent}1f`, borderColor: `${accent}40` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} strokeWidth={2} />
        </span>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold text-foreground">{label}</div>
          <div className="text-[11px] text-foreground/45">{hint}</div>
        </div>
      </div>

      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = opt === value;
          const { color, blurb } = toolVisual(opt);
          return (
            <motion.button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className={cn(
                "group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-xl border p-3 text-left transition-colors duration-200",
                active
                  ? "border-accent bg-accent-subtle"
                  : "border-border bg-surface hover:border-border hover:bg-surface-hover"
              )}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors"
                style={{ backgroundColor: `${color}1a` }}
              >
                <ToolLogo name={opt} size={18} />
              </span>

              <span className="w-full min-w-0">
                <span className="block truncate text-[13px] font-medium text-foreground">{opt}</span>
                <span className="block truncate text-[11px] text-foreground/45">{blurb}</span>
              </span>

              <AnimatePresence>{active && <SelectedTick />}</AnimatePresence>
            </motion.button>
          );
        })}

        {/* Always-present custom choice — type your own tool name. */}
        <motion.button
          type="button"
          role="radio"
          aria-checked={isCustom}
          onClick={pickCustom}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: "spring", stiffness: 400, damping: 26 }}
          className={cn(
            "group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-xl border p-3 text-left transition-colors duration-200",
            isCustom
              ? "border-accent bg-accent-subtle"
              : "border-dashed border-border bg-surface hover:border-border hover:bg-surface-hover"
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface transition-colors">
            <Pencil className="h-[18px] w-[18px] text-foreground/70" strokeWidth={2} />
          </span>

          <span className="w-full min-w-0">
            <span className="block truncate text-[13px] font-medium text-foreground">Eigenes</span>
            <span className="block truncate text-[11px] text-foreground/45">Tool selbst angeben</span>
          </span>

          <AnimatePresence>{isCustom && <SelectedTick />}</AnimatePresence>
        </motion.button>
      </div>

      {/* Free-text entry — only while the custom card is selected. */}
      <AnimatePresence initial={false}>
        {isCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              <Input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="z. B. Deepseek, MongoDB…"
                aria-label={`${label} — eigenes Tool`}
                maxLength={40}
                className={cn(
                  "h-10",
                  customEmpty && "border-red-500/55 focus:border-red-500/70 focus:ring-red-500/20"
                )}
              />
              {customEmpty && (
                <p className="mt-1 text-[11px] text-red-300/90">Gib einen Tool-Namen ein.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The shared spring-in checkmark badge for a selected card. */
function SelectedTick() {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 22 }}
      className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent"
    >
      <Check className="h-3 w-3 text-foreground" strokeWidth={3} />
    </motion.span>
  );
}

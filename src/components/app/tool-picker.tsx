"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { ToolLogo, toolVisual } from "@/components/brand/tool-logos";
import { cn } from "@/lib/utils";

/**
 * A category of build-target choices rendered as selectable product cards:
 * brand logo, blurb, hover-lift, a violet selected-glow and a spring-in
 * checkmark. Generic over the option union so it stays type-safe per category.
 */
export function ToolPickerGroup<T extends string>({
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
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg border"
          style={{ backgroundColor: `${accent}1f`, borderColor: `${accent}40` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} strokeWidth={2} />
        </span>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold text-white">{label}</div>
          <div className="text-[11px] text-white/45">{hint}</div>
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
                  ? "border-violet-400/60 bg-gradient-to-b from-violet-500/[0.14] to-violet-500/[0.02] shadow-[0_0_0_1px_rgba(167,139,250,0.45),0_10px_30px_-12px_rgba(124,58,237,0.55)]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.045]"
              )}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 transition-colors"
                style={{ backgroundColor: `${color}1a` }}
              >
                <ToolLogo name={opt} size={18} />
              </span>

              <span className="w-full min-w-0">
                <span className="block truncate text-[13px] font-medium text-white">{opt}</span>
                <span className="block truncate text-[11px] text-white/45">{blurb}</span>
              </span>

              <AnimatePresence>
                {active && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 22 }}
                    className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 shadow-[0_2px_8px_rgba(124,58,237,0.6)]"
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

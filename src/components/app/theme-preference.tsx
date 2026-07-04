"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * The theme switch lives here now, not as a header button (Theme-Entscheidung,
 * REDESIGN): the public site keeps one deliberate, always-light mood, and
 * inside the app the choice is a considered workspace preference instead of a
 * one-click header toy. next-themes still does the actual work — persists to
 * localStorage, resolves "system" via prefers-color-scheme — only the UI
 * surface moved from the topbar to here.
 */
export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  // Gate the active-option highlight on mount so the server render and first
  // client render agree (the stored theme is only knowable client-side).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Erscheinungsbild">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 text-[13px] transition-colors",
              active
                ? "border-accent/50 bg-accent-subtle text-accent-text"
                : "border-border bg-surface text-foreground/70 hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const OPTIONS = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * The theme switch lives here now, not as a header button (Theme-Entscheidung,
 * REDESIGN): the public site keeps one deliberate, always-light mood, and
 * inside the app the choice is a considered workspace preference instead of a
 * one-click header toy. next-themes still does the actual work, persists to
 * localStorage, resolves "system" via prefers-color-scheme, only the UI
 * surface moved from the topbar to here.
 */
export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  // Gate the active-option highlight on mount so the server render and first
  // client render agree (the stored theme is only knowable client-side).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = mounted ? OPTIONS.findIndex((o) => o.value === theme) : -1;
  // Vor der Hydration (oder bei einem unbekannten Theme-Wert) muss trotzdem
  // GENAU ein Radio im Tab-Index stehen, sonst laesst sich die Gruppe per
  // Tastatur gar nicht erst erreichen.
  const focusableIndex = activeIndex === -1 ? 0 : activeIndex;

  function selectAndFocus(index: number) {
    buttonRefs.current[index]?.focus();
    setTheme(OPTIONS[index].value);
  }

  // B-10 (Audit 06.09.2026, zweiter Durchgang): `role="radiogroup"` +
  // `role="radio"` versprachen das WAI-ARIA Radio-Group-Pattern (Pfeiltasten
  // wechseln die Auswahl, nur EIN Radio steht im Tab-Index) — jeder Button
  // war aber einzeln per Tab erreichbar, und keine Taste tat etwas. Eine
  // Attrappe des Musters, nicht das Muster selbst.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = OPTIONS.length - 1;
    }
    if (next === null) return;
    event.preventDefault();
    selectAndFocus(next);
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Erscheinungsbild">
      {OPTIONS.map(({ value, label, Icon }, index) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={index === focusableIndex ? 0 : -1}
            onClick={() => setTheme(value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
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

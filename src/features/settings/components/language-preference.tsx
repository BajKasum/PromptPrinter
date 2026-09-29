"use client";

import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALES, LOCALE_NAMES } from "@/shared/i18n/locales";
import { useChangeLocale } from "@/shared/i18n/use-change-locale";

/**
 * Die Sprachwahl in den Einstellungen. Dasselbe Radio-Group-Muster wie
 * ThemePreference daneben (Pfeiltasten wechseln, nur die aktive Option im
 * Tab-Index), damit sich die beiden Karten gleich bedienen lassen.
 *
 * Jede Sprache steht in ihrem eigenen Namen ("English", "Français"), nicht
 * übersetzt: wer die aktuelle Sprache nicht lesen kann, findet seine so
 * trotzdem.
 */
export function LanguagePreference() {
  const t = useT();
  const locale = useLocale();
  const { change, pending } = useChangeLocale();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = LOCALES.indexOf(locale);

  function selectAndFocus(index: number) {
    buttonRefs.current[index]?.focus();
    void change(LOCALES[index]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % LOCALES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + LOCALES.length) % LOCALES.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = LOCALES.length - 1;
    }
    if (next === null) return;
    event.preventDefault();
    selectAndFocus(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={t.settings.language}
      aria-busy={pending}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      {LOCALES.map((code, index) => {
        const active = code === locale;
        return (
          <button
            key={code}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={index === activeIndex ? 0 : -1}
            lang={code}
            onClick={() => !active && void change(code)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
              active
                ? "border-accent/50 bg-accent-subtle text-accent-text"
                : "border-border bg-surface text-foreground/70 hover:border-border-strong hover:bg-surface-hover hover:text-foreground"
            )}
          >
            <span>{LOCALE_NAMES[code]}</span>
            {active && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />}
          </button>
        );
      })}
    </div>
  );
}

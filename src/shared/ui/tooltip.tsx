"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

// Ein Tooltip, wie ihn ChatGPT und Claude am Plus-Knopf des Composers zeigen:
// eine kleine dunkle Pille mit dem Namen der Aktion, kurz nach dem Hovern.
//
// Es ist bewusst NUR eine Ergänzung. Der Knopf selbst trägt denselben Text als
// aria-label, deshalb ist die Pille aria-hidden: ein Screenreader hört den
// Namen einmal, nicht zweimal. Und weil ein Tooltip nie der einzige Weg zu
// einer Information sein darf, steht auf Touch-Geräten (kein Hover) nichts
// Wichtiges nur hier.
//
// Zwei Auslöser, mit Absicht verschieden schnell:
//   * Maus-Hover erst nach einer kurzen Verzögerung (HOVER_DELAY_MS), damit
//     ein Mauszeiger, der nur vorbeifährt, nichts aufblitzen lässt.
//   * Tastaturfokus sofort, aber NUR bei :focus-visible. Ein Klick setzt
//     ebenfalls den Fokus, und die Pille würde dann stehenbleiben, während der
//     Dateidialog offen ist und danach weiter — genau das soll sie nicht.

const HOVER_DELAY_MS = 400;

export function Tooltip({
  label,
  children,
  align = "center",
  className,
}: {
  label: string;
  children: React.ReactNode;
  /**
   * Wo die Pille unter dem Auslöser sitzt. "start" bündig am linken Rand: ein
   * Knopf am linken Rand des Composers würde eine zentrierte Pille aus dem
   * Container (und auf dem Handy aus dem Bildschirm) schieben.
   */
  align?: "center" | "start";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  // Beim Verschwinden des Auslösers darf kein Timer mehr feuern.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <span
      className={cn("relative inline-flex", className)}
      onPointerEnter={(e) => {
        // Touch löst pointerenter beim Antippen aus: dort kein Tooltip, es gibt
        // keinen Hover, und er bliebe nach dem Tippen stehen.
        if (e.pointerType !== "mouse") return;
        cancel();
        timer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
      }}
      onPointerLeave={() => {
        cancel();
        setOpen(false);
      }}
      onPointerDown={() => {
        // Wer klickt, hat die Antwort auf "was macht das?" schon gegeben.
        cancel();
        setOpen(false);
      }}
      onFocus={(e) => {
        if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) {
          cancel();
          setOpen(true);
        }
      }}
      onBlur={() => {
        cancel();
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancel();
          setOpen(false);
        }
      }}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-full z-30 mt-2 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-[12.5px] font-medium leading-none text-primary-foreground shadow-lg transition-opacity duration-150",
          align === "start" ? "left-0" : "left-1/2 -translate-x-1/2",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}

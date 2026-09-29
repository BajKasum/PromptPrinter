"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// Ein Eintrag im Kontomenü, der seitlich ein zweites Panel aufklappt
// ("Mehr erfahren", "Sprache"), wie bei Claude. Offen ist immer höchstens
// eines; den Zustand hält deshalb das Kontomenü, nicht dieser Eintrag.
//
// Muster: Disclosure (Button mit aria-expanded + aria-controls), kein ARIA-
// "menu" — das übrige Kontomenü ist eine Liste gewöhnlicher Links, und ein
// role="menu" würde von Screenreadern Pfeiltasten-Navigation über ALLE
// Einträge erwarten lassen, die es dort nicht gibt.
//
// Positioniert wird am Viewport (fixed), aus demselben Grund wie das
// Kontomenü selbst: die Seitenleiste schneidet ihren Überlauf ab. Das Panel
// sitzt rechts neben dem Menü, mit der Unterkante auf Höhe des Eintrags, und
// wächst nach oben — das Kontomenü steht immer am unteren Bildschirmrand.

const FLYOUT_WIDTH = 248;
const GAP = 6;
const GUTTER = 8;

export function AccountSubmenu({
  id,
  label,
  Icon,
  hint,
  open,
  onOpenChange,
  children,
}: {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Kurzer Wert rechts im Eintrag, z. B. die aktuelle Sprache. */
  hint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Per Tastatur geöffnet? Dann wandert der Fokus ins Panel, per Maus nicht
  // (sonst springt der Fokusring beim blossen Darüberfahren herum).
  const focusOnOpen = useRef(false);
  const [pos, setPos] = useState<{ left: number; bottom: number; maxHeight: number } | null>(
    null
  );

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function measure() {
      const trigger = triggerRef.current;
      const menu = trigger?.closest<HTMLElement>("[data-account-menu]");
      if (!trigger || !menu) return;
      const row = trigger.getBoundingClientRect();
      const box = menu.getBoundingClientRect();
      const width = Math.min(FLYOUT_WIDTH, window.innerWidth - GUTTER * 2);
      // Rechts neben das Menü; passt es dort nicht hin, links daneben.
      let left = box.right + GAP;
      if (left + width > window.innerWidth - GUTTER) left = box.left - width - GAP;
      left = Math.max(GUTTER, left);
      const bottom = Math.max(GUTTER, window.innerHeight - row.bottom - GAP);
      setPos({ left, bottom, maxHeight: window.innerHeight - bottom - GUTTER });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  useEffect(() => {
    if (!open || !pos || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open, pos]);

  function close() {
    onOpenChange(false);
    triggerRef.current?.focus();
  }

  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" || e.key === "ArrowLeft") {
      e.preventDefault();
      // Nur das Untermenü schliessen, nicht das ganze Kontomenü (dessen
      // Escape-Listener hängt am window und käme sonst als Nächstes dran).
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("a, button") ?? []
      );
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? i + 1 : i - 1;
      items[(next + items.length) % items.length]?.focus();
    }
  }

  const panelId = `${id}-panel`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          // detail === 0: per Enter/Leertaste ausgelöst, nicht per Maus.
          focusOnOpen.current = e.detail === 0;
          // Öffnen, nicht umschalten: die Maus hat das Panel beim
          // Darüberfahren meist schon geöffnet, ein Umschalten würde es mit
          // dem Klick gleich wieder zuklappen. Zu geht es mit Escape,
          // Pfeil links, Wegklicken oder über einen anderen Eintrag.
          if (open && focusOnOpen.current) {
            panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
            focusOnOpen.current = false;
          }
          onOpenChange(true);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") onOpenChange(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            focusOnOpen.current = true;
            onOpenChange(true);
          }
        }}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-hover hover:text-foreground",
          open ? "bg-surface-hover text-foreground" : "text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {hint && <span className="shrink-0 text-[12px] text-tertiary">{hint}</span>}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-tertiary" strokeWidth={2} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={label}
          onKeyDown={onPanelKeyDown}
          style={
            pos
              ? { left: pos.left, bottom: pos.bottom, maxHeight: pos.maxHeight, width: FLYOUT_WIDTH }
              : undefined
          }
          className={cn(
            "fixed z-[60] overflow-y-auto rounded-xl border border-border bg-surface-raised p-1.5 shadow-elevated",
            !pos && "invisible"
          )}
        >
          {children}
        </div>
      )}
    </>
  );
}

/** Eine Zeile im Untermenü, dieselbe Optik wie die Einträge im Kontomenü. */
export const SUBMENU_ROW =
  "focus-glow flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

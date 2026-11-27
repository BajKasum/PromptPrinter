"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "@/shared/lib/utils";

// Das gemeinsame Gerüst modaler Fenster: `Dialog` (Portal, abgedunkelter Hintergrund, Animation) und darunter
// `useModal`, die Tastatur-Seite von `aria-modal`. Den Hook nutzt auch, wer sein Fenster selbst baut (der Drawer der
// Mobile-Navigation).

// Was die Tabulator-Taste erreichen kann. `tabIndex={-1}` und `disabled` nehmen ein Element heraus.
const CANDIDATES = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

function tabbable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(CANDIDATES)).filter(
    (el) => el.tabIndex >= 0 && !el.matches(":disabled")
  );
}

/** Tab bleibt im Rahmen: an den Enden springt der Fokus ans andere Ende, dazwischen läuft der Browser wie gewohnt. */
function keepTabInside(e: KeyboardEvent, container: HTMLElement) {
  const items = tabbable(container);
  const active = document.activeElement;
  const back = e.shiftKey;
  // In Laufrichtung: das erste Element hier ist das Ziel, wenn der Fokus von aussen kommt.
  const ordered = back ? [...items].reverse() : items;
  let target: HTMLElement | undefined;
  if (items.includes(active as HTMLElement)) {
    if (active !== ordered[ordered.length - 1]) return;
    target = ordered[0];
  } else {
    // Der Fokus liegt draussen, auf dem Rahmen selbst oder auf einem inzwischen gesperrten Knopf. Von einem Element
    // im Rahmen aus geht es zum nächsten in Laufrichtung.
    const within = active && active !== container && container.contains(active);
    const side = back ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
    const next = within ? ordered.find((el) => active.compareDocumentPosition(el) & side) : undefined;
    target = next ?? ordered[0];
  }
  e.preventDefault();
  (target ?? container).focus();
}

// Die offenen modalen Fenster in der Reihenfolge, in der sie aufgingen. Tasten gelten nur dem obersten.
const openModals: symbol[] = [];

/** Steht schon ein modales Fenster offen? Dann öffnet ein globales Kürzel kein zweites. */
export function isModalOpen() {
  return openModals.length > 0;
}

type ModalOptions = {
  /** Escape. Der Aufrufer entscheidet, ob er gerade schliessen darf. */
  onClose: () => void;
  /** Wohin der Fokus beim Öffnen geht, sonst auf das erste erreichbare Element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** `false` lässt den Fokus beim Schliessen, wo er ist, etwa vor einem Seitenwechsel. */
  returnFocus?: () => boolean;
};

/**
 * Solange `open` gilt: Fokus ins Fenster holen, Tab darin halten, Escape melden, und beim Schliessen den Fokus an
 * das Element zurückgeben, das ihn vorher hatte. `containerRef` braucht `tabIndex={-1}`: dort landet der Fokus,
 * wenn im Fenster nichts erreichbar ist.
 */
export function useModal({
  open,
  containerRef,
  ...options
}: ModalOptions & { open: boolean; containerRef: RefObject<HTMLElement | null> }) {
  // Die Aufrufer übergeben bei jedem Rendern neue Funktionen; das Öffnen selbst darf davon nicht neu laufen.
  const latest = useRef<ModalOptions>(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol("modal");
    openModals.push(id);
    const onTop = () => openModals[openModals.length - 1] === id;
    const opener =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;

    // Erst einen Moment später: die Taste, die das Fenster geöffnet hat, soll nicht schon darin etwas auslösen.
    const timer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container || !onTop()) return;
      const target = latest.current.initialFocusRef?.current ?? tabbable(container)[0] ?? container;
      target.focus({ preventScroll: true });
      // Ein gesperrtes Ziel nimmt den Fokus nicht an.
      if (document.activeElement !== target) container.focus({ preventScroll: true });
    }, 20);

    function onKeyDown(e: KeyboardEvent) {
      if (!onTop()) return;
      if (e.key === "Tab") {
        if (containerRef.current) keepTabInside(e, containerRef.current);
      } else if (e.key === "Escape" && !e.isComposing) {
        e.preventDefault();
        latest.current.onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      openModals.splice(openModals.indexOf(id), 1);
      // Zurück nur, wenn der Fokus noch hier liegt oder verloren ist: wer ihn inzwischen woandershin gesetzt hat,
      // behält ihn.
      const active = document.activeElement;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- gewollt: es zählt der Rahmen beim Schliessen
      const unclaimed = !active || active === document.body || containerRef.current?.contains(active);
      if (unclaimed && opener?.isConnected && (latest.current.returnFocus?.() ?? true)) opener.focus();
    };
  }, [open, containerRef]);
}

const PLACEMENT = {
  center: { overlay: "z-95 items-center", panel: "max-w-md", y: 8 },
  top: { overlay: "z-90 pt-[12vh]", panel: "h-fit max-w-xl", y: -8 },
} as const;

/** Modaler Dialog über abgedunkeltem Hintergrund. Ein Klick daneben und Escape rufen `onClose`. */
export function Dialog({
  open,
  label,
  placement = "center",
  children,
  ...modal
}: ModalOptions & {
  open: boolean;
  /** Der Name des Dialogs für Screenreader. */
  label: string;
  /** "top": oben angesetzt und breiter, für die Befehlspalette. */
  placement?: keyof typeof PLACEMENT;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useModal({ open, containerRef: panelRef, ...modal });

  if (!mounted) return null;
  const { overlay, panel, y } = PLACEMENT[placement];

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className={cn("fixed inset-0 flex justify-center bg-black/60 px-4 backdrop-blur-xs", overlay)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            // Ohne das nähme der Browser dem Element, das den Fokus gerade zurückbekommt, ihn gleich wieder weg.
            e.preventDefault();
            modal.onClose();
          }}
        >
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.98, y }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "w-full overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated focus:outline-hidden",
              panel
            )}
          >
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

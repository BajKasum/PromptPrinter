"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, BookmarkPlus, Package } from "lucide-react";

// The save/packet handoff sits behind one quiet icon button, closed by
// default — reachable without ever showing as a permanent action bar next to
// reading or writing (same click-away pattern the topbar's dropdowns use).
// Fully self-contained: owns its own open state and Escape handling, so the
// parent chat only needs to know which handoff the user picked.
export function ChatHandoffMenu({
  isWorkspace,
  onSave,
  onPacket,
}: {
  isWorkspace: boolean;
  onSave: () => void;
  onPacket: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes the handoff menu — same convention as the topbar's dropdowns.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Nächster Schritt"
        aria-haspopup="true"
        aria-expanded={open}
        title="Nächster Schritt"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} />
      </button>
      {open && (
        <>
          <button
            aria-label="Menü schliessen"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full right-0 z-50 mb-2 w-60 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSave();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-foreground/85 transition-colors hover:bg-surface-hover"
            >
              <BookmarkPlus className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
              {isWorkspace ? "Prompt erzeugen" : "Prompt speichern"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onPacket();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-foreground/85 transition-colors hover:bg-surface-hover"
            >
              <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
              {isWorkspace ? "Software-Paket erzeugen" : "Software-Paket bauen"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

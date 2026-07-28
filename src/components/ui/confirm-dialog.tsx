"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared accessible confirm dialog (portal, focus-on-open, Escape-to-cancel,
// backdrop click, all gated on `busy` so a click can't interrupt the action
// in flight) — factored out of what was originally delete-project.tsx's own
// inline dialog so a second irreversible action doesn't have to rebuild the
// same wiring (QA finding A-2: project-files.tsx's per-file delete had none
// of it, a Tab-reachable, unconfirmed, irreversible delete).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Focus the safe default (Cancel) the instant the dialog opens, so keyboard
  // and screen-reader users land inside it instead of on the trigger behind it.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape closes the dialog, but never while the confirmed action is in flight.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  function close() {
    if (!busy) onCancel();
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated"
          >
            <div className="flex items-start gap-3 border-b border-border p-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/[0.08]">
                <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-[13px] text-secondary">{description}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button ref={cancelRef} variant="ghost" onClick={close} disabled={busy}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={onConfirm} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {busyLabel}
                  </>
                ) : (
                  confirmLabel
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

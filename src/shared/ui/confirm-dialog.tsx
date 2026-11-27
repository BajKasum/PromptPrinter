"use client";

import { useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { useT } from "@/shared/i18n/provider";

// Die Rückfrage vor einer Aktion, auf `Dialog`. Beim Öffnen liegt der Fokus auf "Abbrechen", dem sicheren Knopf.
// Solange `busy` gilt, schliesst weder Escape noch ein Klick daneben: die laufende Aktion lässt sich nicht
// unterbrechen.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  /**
   * "danger" (Vorgabe): eine unumkehrbare Aktion, roter Knopf, Warnzeichen.
   * "neutral": eine Zustimmung oder Bestätigung ohne Verlust, etwa die
   * Einwilligung zum Sprachmodus; Schild statt Warnzeichen, normaler Knopf.
   */
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);

  function close() {
    if (!busy) onCancel();
  }

  return (
    <Dialog open={open} onClose={close} label={title} initialFocusRef={cancelRef}>
      <div className="flex items-start gap-3 border-b border-border p-5">
        {tone === "neutral" ? (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/8">
            <ShieldCheck className="h-4 w-4 text-accent-text" strokeWidth={1.8} aria-hidden />
          </div>
        ) : (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/8">
            <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.8} />
          </div>
        )}
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-[13px] text-secondary">{description}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <Button ref={cancelRef} variant="ghost" onClick={close} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button variant={tone === "neutral" ? "primary" : "destructive"} onClick={onConfirm} disabled={busy}>
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
    </Dialog>
  );
}

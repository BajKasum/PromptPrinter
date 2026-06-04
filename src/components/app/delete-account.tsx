"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function DeleteAccount({ email }: { email: string }) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset + focus the field each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setConfirm("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  // Require the exact email so deletion can never be a stray click.
  const matches = confirm.trim().toLowerCase() === email.trim().toLowerCase();
  const canDelete = matches && !deleting;

  function close() {
    if (!deleting) setOpen(false);
  }

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unbekannter Fehler.");
      }
      // Account + session are gone — hard navigate to a clean public page.
      window.location.href = "/";
    } catch (err) {
      setDeleting(false);
      toast({
        title: "Löschen fehlgeschlagen",
        description: err instanceof Error ? err.message : "Bitte versuche es erneut.",
        variant: "error",
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && canDelete) {
      e.preventDefault();
      void handleDelete();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[14px] font-medium text-white">Konto löschen</div>
          <div className="text-[12.5px] text-white/55">
            Entfernt dein Konto und alle Projekte und Generierungen unwiderruflich.
          </div>
        </div>
        <Button
          variant="destructive"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          Löschen
        </Button>
      </div>

      {mounted &&
        createPortal(
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
                  aria-label="Konto löschen bestätigen"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#111113] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]"
                >
                  <div className="flex items-start gap-3 border-b border-white/[0.06] p-5">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/[0.08]">
                      <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-white">
                        Konto endgültig löschen?
                      </h2>
                      <p className="mt-1 text-[13px] text-white/55">
                        Diese Aktion ist unwiderruflich. Alle deine Projekte und Generierungen
                        werden dauerhaft entfernt.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    <label htmlFor="confirm-email" className="block text-[13px] text-white/70">
                      Tippe zur Bestätigung deine E-Mail{" "}
                      <span className="font-mono text-white/90">{email}</span>
                    </label>
                    <input
                      id="confirm-email"
                      ref={inputRef}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={onKeyDown}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={email}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 text-sm text-white placeholder:text-white/30 focus:border-red-500/55 focus:outline-none focus:ring-2 focus:ring-red-500/15"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
                    <Button variant="ghost" onClick={close} disabled={deleting}>
                      Abbrechen
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleDelete()}
                      disabled={!canDelete}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wird gelöscht…
                        </>
                      ) : (
                        "Konto löschen"
                      )}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { useT } from "@/shared/i18n/provider";
import { createClient } from "@/shared/supabase/client";

export function DeleteAccount({ email }: { email: string }) {
  const t = useT();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Der Server verlangt eine frische Anmeldung (#132): dann zeigt der Dialog das statt des Eingabefelds.
  const [needsReauth, setNeedsReauth] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset + focus the field each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setConfirm("");
    setNeedsReauth(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
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
        const body = (await res.json().catch(() => null)) as { detail?: string; code?: string } | null;
        if (res.status === 403 && body?.code === "reauth_required") {
          setDeleting(false);
          setNeedsReauth(true);
          return;
        }
        throw new Error(body?.detail ?? t.common.unknownError);
      }
      // Account + session are gone, hard navigate to a clean public page.
      window.location.href = "/";
    } catch (err) {
      setDeleting(false);
      toast({
        title: t.settings.deleteAccount.failed,
        description: err instanceof Error ? err.message : t.settings.tryAgain,
        variant: "error",
      });
    }
  }

  // Neu anmelden: diese Sitzung beenden (nur hier, andere Geräte bleiben angemeldet) und zur Anmeldung, die
  // danach wieder in die Einstellungen führt. Die neue Sitzung trägt eine frische Anmeldung.
  async function reauthenticate() {
    setLeaving(true);
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // Scheitert das Abmelden, leitet die Middleware von /login nach /chats/new; der Weg lässt sich wiederholen.
    }
    window.location.href = `/login?next=${encodeURIComponent("/settings")}`;
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
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[14px] font-medium text-foreground">
            {t.settings.deleteAccount.title}
          </div>
          <div className="text-[12.5px] text-secondary">{t.settings.deleteAccount.body}</div>
        </div>
        <Button
          variant="destructive"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          {t.common.delete}
        </Button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <m.div
                className="fixed inset-0 z-95 flex items-center justify-center bg-black/60 px-4 backdrop-blur-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onMouseDown={close}
              >
                <m.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.settings.deleteAccount.dialog}
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated"
                >
                  <div className="flex items-start gap-3 border-b border-border p-5">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/8">
                      <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-foreground">
                        {t.settings.deleteAccount.confirmTitle}
                      </h2>
                      <p className="mt-1 text-[13px] text-secondary">
                        {t.settings.deleteAccount.confirmBody}
                      </p>
                    </div>
                  </div>

                  {needsReauth ? (
                    <div className="p-5">
                      <p role="alert" className="text-[13px] text-foreground/80">
                        {t.settings.deleteAccount.reauthBody}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 p-5">
                      <label htmlFor="confirm-email" className="block text-[13px] text-foreground/70">
                        {t.settings.deleteAccount.typeEmail}{" "}
                        <span className="font-mono text-foreground/90">{email}</span>
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
                        className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-destructive/55 focus:outline-hidden focus:ring-2 focus:ring-destructive/15"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                    <Button variant="ghost" onClick={close} disabled={deleting || leaving}>
                      {t.common.cancel}
                    </Button>
                    {needsReauth ? (
                      <Button onClick={() => void reauthenticate()} disabled={leaving}>
                        {leaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t.settings.deleteAccount.reauthAction}
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => void handleDelete()}
                        disabled={!canDelete}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t.common.deleting}
                          </>
                        ) : (
                          t.settings.deleteAccount.title
                        )}
                      </Button>
                    )}
                  </div>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Focus the safe default (Cancel) the instant the dialog opens, so keyboard
  // and screen-reader users land inside it instead of on the trigger behind it.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape closes the dialog — but never while a delete is in flight.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, deleting]);

  function close() {
    if (!deleting) setOpen(false);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    const supabase = createClient();
    // RLS scopes this to the owner; generations and the refine-chat cascade away.
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      setDeleting(false);
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Bitte versuche es erneut.",
        variant: "error",
      });
      return;
    }
    toast({
      title: "Projekt gelöscht",
      description: `„${projectName}“ wurde entfernt.`,
      variant: "success",
    });
    // The detail page no longer exists — leave for the list, which re-fetches.
    router.push("/projects");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0 text-foreground/55 hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Löschen
      </Button>

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
                  aria-label="Projekt löschen bestätigen"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated"
                >
                  <div className="flex items-start gap-3 border-b border-border p-5">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/[0.08]">
                      <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={1.8} />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-semibold text-foreground">
                        Projekt löschen?
                      </h2>
                      <p className="mt-1 text-[13px] text-foreground/55">
                        „{projectName}“ wird mit allen Artefakten und dem Verfeinerungs-Chat
                        dauerhaft entfernt. Das kann nicht rückgängig gemacht werden.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                    <Button ref={cancelRef} variant="ghost" onClick={close} disabled={deleting}>
                      Abbrechen
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wird gelöscht…
                        </>
                      ) : (
                        "Projekt löschen"
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

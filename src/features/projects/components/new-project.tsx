"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/ui/toast";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

// Direct workspace creation (REDESIGN.md, Phase 3): "Neues Projekt" ist ein
// echter Projektstart, ein Name genügt, kein Umweg über einen Chat. Der
// Dialog folgt der delete-project-Choreografie (Portal, Escape, Fokus).

export function NewProjectButton({
  variant = "action",
  className,
}: {
  /** "action" = Seiten-Button (Button-Komponente, primary). "bar" = die
   * "Neuer Chat"-Leiste in Sidebar/Mobile-Drawer, exakt deren Klassen über
   * `className` gespiegelt, damit ein Projekt genauso startet wie ein Chat. */
  variant?: "action" | "bar";
  /** Nur für variant="bar", die Klassen der Aufrufstelle (spiegelt "Neuer Chat"). */
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !creating) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, creating]);

  function close() {
    if (creating) return;
    setOpen(false);
    setError(null);
  }

  const valid = name.trim().length >= 2;

  async function create() {
    if (!valid || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? t.projects.createFailed);
      const projectId = json.projectId as string;
      toast({
        title: t.projects.created,
        description: fmt(t.projects.createdBody, { name: name.trim() }),
        variant: "success",
      });
      setOpen(false);
      setName("");
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.unknownError);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {variant === "bar" ? (
        <button type="button" onClick={() => setOpen(true)} className={className}>
          <FolderPlus className="h-4 w-4" />
          {t.projects.newProject}
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <FolderPlus className="h-4 w-4" />
          {t.projects.newProject}
        </Button>
      )}

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
                  aria-label={t.projects.newProjectDialog}
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface-raised shadow-elevated"
                >
                  <div className="border-b border-border p-5">
                    <h2 className="text-[15px] font-semibold text-foreground">
                      {t.projects.newProject}
                    </h2>
                    <p className="mt-1 text-[13px] text-secondary">{t.projects.newProjectHint}</p>
                  </div>

                  <div className="p-5">
                    {error && (
                      <div
                        role="alert"
                        className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
                      >
                        {error}
                      </div>
                    )}
                    <Label htmlFor="new-project-name">{t.projects.nameLabel}</Label>
                    <Input
                      id="new-project-name"
                      ref={inputRef}
                      value={name}
                      maxLength={80}
                      placeholder={t.projects.namePlaceholder}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void create();
                        }
                      }}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                    <Button variant="ghost" onClick={close} disabled={creating}>
                      {t.common.cancel}
                    </Button>
                    <Button variant="accent" onClick={() => void create()} disabled={!valid || creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.projects.creating}
                        </>
                      ) : (
                        t.projects.create
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

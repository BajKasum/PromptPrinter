"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/ui/toast";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";
import { UserError, failureText, readJson, readProblem } from "@/shared/lib/read-problem";

// Direct workspace creation (REDESIGN.md, Phase 3): "Neues Projekt" ist ein
// echter Projektstart, ein Name genügt, kein Umweg über einen Chat.

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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (!res.ok) throw await readProblem(res, t.projects.createFailed);
      const projectId = (await readJson<{ projectId?: unknown }>(res))?.projectId;
      if (typeof projectId !== "string") throw new UserError(t.projects.createFailed);
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
      setError(failureText(e, { network: t.common.networkError, fallback: t.projects.createFailed }));
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

      <Dialog open={open} onClose={close} label={t.projects.newProjectDialog} initialFocusRef={inputRef}>
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
      </Dialog>
    </>
  );
}

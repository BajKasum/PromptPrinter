"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, X, Trash2, FileDown, Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { relativeTime } from "@/lib/utils";
import type { SavedPrompt } from "@/lib/saved-prompts";

// The Ergebnisse/Gespeicherte-Prompts list: one card per saved prompt, newest
// first. Each card is a read-and-reuse unit: copy the prompt, rename it,
// export it as PDF (Pro), or delete it. Rename and delete go through the
// RLS-scoped browser client (owner-only update/delete policy, 0001/0018) and
// refresh so any visible counters (project header/rail) stay in sync. No
// editing the prompt text itself: a saved prompt is an immutable snapshot, to
// change one, save a fresh version from the chat — only its name is yours to
// change (QA finding N-1: naming is the whole point of a saved-prompt
// library, "sessionStartPrompt" only means something if you chose the name).
export function SavedPromptList({
  prompts,
  canExportPdf,
}: {
  prompts: SavedPrompt[];
  canExportPdf: boolean;
}) {
  const [items, setItems] = useState(prompts);

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <SavedPromptCard
          key={p.id}
          prompt={p}
          canExportPdf={canExportPdf}
          onDeleted={() => setItems((list) => list.filter((it) => it.id !== p.id))}
          onRenamed={(title) =>
            setItems((list) => list.map((it) => (it.id === p.id ? { ...it, title } : it)))
          }
        />
      ))}
    </div>
  );
}

function SavedPromptCard({
  prompt,
  canExportPdf,
  onDeleted,
  onRenamed,
}: {
  prompt: SavedPrompt;
  canExportPdf: boolean;
  onDeleted: () => void;
  onRenamed: (title: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(prompt.title);

  async function exportPdf() {
    const { downloadMarkdownAsPdf } = await import("@/lib/pdf-export");
    downloadMarkdownAsPdf(`${prompt.title}.pdf`, prompt.title, prompt.content);
  }

  function cancelRename() {
    setTitle(prompt.title);
    setRenaming(false);
  }

  async function rename() {
    const next = title.trim().slice(0, 80);
    if (!next || next === prompt.title) {
      cancelRename();
      return;
    }
    setBusy(true);
    const supabase = createClient();
    // outputs is one JSONB column (prompt, title, target), so renaming writes
    // it back whole — the card already holds the other two fields in memory,
    // no read-modify-write round trip needed.
    const { error } = await supabase
      .from("generations")
      .update({
        outputs: {
          prompt: prompt.content,
          title: next,
          ...(prompt.target ? { target: prompt.target } : {}),
        },
      })
      .eq("id", prompt.id);
    setBusy(false);
    if (error) {
      toast({
        title: "Umbenennen fehlgeschlagen",
        description: "Bitte versuch es erneut.",
        variant: "error",
      });
      return;
    }
    setRenaming(false);
    onRenamed(next);
    router.refresh();
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("generations").delete().eq("id", prompt.id);
    if (error) {
      setDeleting(false);
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Der Prompt konnte nicht entfernt werden.",
        variant: "error",
      });
      return;
    }
    onDeleted();
    toast({ title: "Prompt gelöscht", variant: "success" });
    router.refresh();
  }

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={title}
                maxLength={80}
                aria-label="Neuer Name für den Prompt"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void rename();
                  } else if (e.key === "Escape") {
                    cancelRename();
                  }
                }}
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[13.5px] text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <button
                type="button"
                onClick={() => void rename()}
                disabled={busy}
                aria-label="Namen speichern"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={busy}
                aria-label="Umbenennen abbrechen"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label={`„${prompt.title}“ umbenennen`}
              className="group/title flex min-w-0 items-center gap-1.5 rounded-md text-left"
            >
              <h3 className="truncate text-[13.5px] font-medium text-foreground">{prompt.title}</h3>
              <Pencil className="h-3 w-3 shrink-0 text-tertiary opacity-0 transition-opacity group-hover/title:opacity-100" />
            </button>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-tertiary">
            {prompt.target && (
              <span className="rounded-full border border-accent/30 bg-accent-subtle px-2 py-0.5 text-accent-text">
                Für {prompt.target}
              </span>
            )}
            <span>{relativeTime(prompt.createdAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => copy(prompt.content)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopiert" : "Kopieren"}
          </button>
          {canExportPdf && (
            <button
              type="button"
              onClick={() => void exportPdf()}
              aria-label="Als PDF exportieren"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <FileDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
            aria-label="Prompt löschen"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-destructive disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </header>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
        {prompt.content}
      </pre>
    </article>
  );
}

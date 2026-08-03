"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, X, Trash2, FileDown, Pencil } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";
import { relativeTime } from "@/shared/lib/utils";
import type { SavedPrompt } from "@/shared/lib/saved-prompts";

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

  // Both mutations apply to this list immediately and undo themselves if the
  // write fails, the same optimistic-with-rollback shape useLibraryFavorites
  // already uses for the favourite toggle. Restoring a delete puts the row
  // back where it was rather than appending it, otherwise a failed delete
  // silently reorders the list (it is sorted newest-first by the server).
  const removeAt = (id: string) => {
    let removed: { item: SavedPrompt; index: number } | null = null;
    setItems((list) => {
      const index = list.findIndex((it) => it.id === id);
      if (index === -1) return list;
      removed = { item: list[index], index };
      return list.filter((it) => it.id !== id);
    });
    return () => {
      const r = removed as { item: SavedPrompt; index: number } | null;
      if (!r) return;
      setItems((list) => {
        const next = list.slice();
        next.splice(Math.min(r.index, next.length), 0, r.item);
        return next;
      });
    };
  };

  const renameTo = (id: string, title: string) => {
    let previous: string | null = null;
    setItems((list) =>
      list.map((it) => {
        if (it.id !== id) return it;
        previous = it.title;
        return { ...it, title };
      })
    );
    return () => {
      const p = previous as string | null;
      if (p === null) return;
      setItems((list) => list.map((it) => (it.id === id ? { ...it, title: p } : it)));
    };
  };

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <SavedPromptCard
          key={p.id}
          prompt={p}
          canExportPdf={canExportPdf}
          onDelete={() => removeAt(p.id)}
          onRename={(title) => renameTo(p.id, title)}
        />
      ))}
    </div>
  );
}

function SavedPromptCard({
  prompt,
  canExportPdf,
  onDelete,
  onRename,
}: {
  prompt: SavedPrompt;
  canExportPdf: boolean;
  /** Applies the removal immediately and returns the undo for a failed write. */
  onDelete: () => () => void;
  /** Applies the new title immediately and returns the undo for a failed write. */
  onRename: (title: string) => () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(prompt.title);

  async function exportPdf() {
    const { downloadMarkdownAsPdf } = await import("@/features/prompts/lib/pdf-export");
    downloadMarkdownAsPdf(`${prompt.title}.pdf`, prompt.title, prompt.content);
  }

  function cancelRename() {
    setTitle(prompt.title);
    setRenaming(false);
  }

  // Both writes are optimistic: the list updates first, the row goes to the
  // server after, and a failure undoes the change and says so. Renaming and
  // deleting your own saved prompt are owner-scoped single-row writes that
  // essentially only fail if the network does — making the user watch a
  // spinner for the round trip (what both of these did before) spent the
  // common case's latency to handle the rare one.
  async function rename() {
    const next = title.trim().slice(0, 80);
    if (!next || next === prompt.title) {
      cancelRename();
      return;
    }
    setRenaming(false);
    const undo = onRename(next);

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
    if (error) {
      // Roll the title back, but reopen the editor holding what the user
      // actually typed. Closing it and dropping their text would make a failed
      // rename cost them the edit — the reason this stayed in rename mode
      // before it became optimistic, and worth keeping now that the close
      // happens up front.
      undo();
      setTitle(next);
      setRenaming(true);
      toast({
        title: "Umbenennen fehlgeschlagen",
        description: "Bitte versuch es erneut.",
        variant: "error",
      });
      return;
    }
    router.refresh();
  }

  async function remove() {
    const undo = onDelete();
    const supabase = createClient();
    const { error } = await supabase.from("generations").delete().eq("id", prompt.id);
    if (error) {
      undo();
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Der Prompt konnte nicht entfernt werden.",
        variant: "error",
      });
      return;
    }
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
              {/* No pending/disabled state on either button any more: the
                  rename closes the editor and updates the title on click,
                  there is no in-flight window left to guard. */}
              <button
                type="button"
                onClick={() => void rename()}
                aria-label="Namen speichern"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                aria-label="Umbenennen abbrechen"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
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
          {/* No spinner: the card is gone from the list the moment this is
              clicked, so there is nothing left on screen to spin. */}
          <button
            type="button"
            onClick={() => void remove()}
            aria-label="Prompt löschen"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
        {prompt.content}
      </pre>
    </article>
  );
}

"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Check, X, Trash2, FileDown, Pencil } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";
import { cn, relativeTime } from "@/shared/lib/utils";
import type { SavedPrompt } from "@/shared/lib/saved-prompts";

// The Ergebnisse/Gespeicherte-Prompts list, newest first.
//
// Seit 23.09.2026 eine Liste von Titeln, auf Kasums Wunsch: zugeklappt steht
// nur der Name des Prompts, ein Klick darauf klappt den Prompt auf, und erst
// dort sitzen Kopieren, Umbenennen, PDF (Pro) und Loeschen. Vorher stand jeder
// Prompt in voller Laenge in der Liste, mit fuenf gespeicherten Prompts war
// das schon eine lange Textwand, in der man seinen Prompt suchen musste.
//
// Der Titel entsteht beim Speichern automatisch aus der ersten Zeile des
// Prompts (derivePromptTitle, saved-prompts.ts), gefragt wird dabei nichts.
// Umbenennen bleibt moeglich (QA finding N-1: "sessionStartPrompt" bedeutet
// nur etwas, wenn man den Namen selbst gewaehlt hat).
//
// Rename and delete go through the RLS-scoped browser client (owner-only
// update/delete policy, 0018/0026) and refresh so any visible counters
// (project header/rail) stay in sync. No editing the prompt text itself: a
// saved prompt is an immutable snapshot, to change one, save a fresh version
// from the chat.
export function SavedPromptList({
  prompts,
  userId,
  canExportPdf,
}: {
  prompts: SavedPrompt[];
  /** Owner, fuer das explizite user_id neben RLS (Defense-in-depth). */
  userId: string;
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
    <ul className="space-y-2">
      {items.map((p) => (
        <li key={p.id}>
          <SavedPromptCard
            prompt={p}
            userId={userId}
            canExportPdf={canExportPdf}
            onDelete={() => removeAt(p.id)}
            onRename={(title) => renameTo(p.id, title)}
          />
        </li>
      ))}
    </ul>
  );
}

function SavedPromptCard({
  prompt,
  userId,
  canExportPdf,
  onDelete,
  onRename,
}: {
  prompt: SavedPrompt;
  userId: string;
  canExportPdf: boolean;
  /** Applies the removal immediately and returns the undo for a failed write. */
  onDelete: () => () => void;
  /** Applies the new title immediately and returns the undo for a failed write. */
  onRename: (title: string) => () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(prompt.title);
  // K-6 (Audit 06.09.2026): der Loesch-Knopf entfernte den gespeicherten
  // Prompt bisher mit einem einzigen Klick, ohne Rueckfrage und ohne Undo —
  // live ausgeloest: ein Klick, sofort weg. Projekt, Datei und Gedaechtnis
  // fragen alle ueber dieselbe ConfirmDialog nach, ausgerechnet der einzige
  // Prompt, den der Nutzer bewusst aufgehoben hat, tat es nicht.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    // outputs is one JSONB column (prompt, title), so renaming writes it back
    // whole — the card already holds the prompt in memory, no
    // read-modify-write round trip needed.
    const { error } = await supabase
      .from("generations")
      .update({
        outputs: {
          prompt: prompt.content,
          title: next,
        },
      })
      .eq("id", prompt.id)
      .eq("user_id", userId);
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
    const { error } = await supabase
      .from("generations")
      .delete()
      .eq("id", prompt.id)
      .eq("user_id", userId);
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
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-surface transition-colors",
        open ? "border-border-strong" : "border-border hover:border-border-strong"
      )}
    >
      {renaming ? (
        <div className="flex items-center gap-1.5 px-3 py-2.5">
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
          {/* No pending/disabled state on either button: the rename closes
              the editor and updates the title on click, there is no in-flight
              window left to guard. */}
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
        // Heading wraps the button (the WAI accordion pattern), not the other
        // way round: a heading inside a <button> is invalid HTML and loses
        // its role for screen readers.
        <h3>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex w-full min-w-0 items-center gap-2.5 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-tertiary transition-transform duration-150",
                open && "rotate-90"
              )}
              strokeWidth={2}
            />
            <span className="truncate text-[14px] font-medium text-foreground">
              {prompt.title}
            </span>
          </button>
        </h3>
      )}

      {open && (
        <div id={panelId} className="border-t border-border">
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
            {prompt.content}
          </pre>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
            <span className="px-1 text-[11.5px] text-tertiary">
              Gespeichert {relativeTime(prompt.createdAt)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => copy(prompt.content)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-subtle px-2.5 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent/15"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Kopiert" : "Kopieren"}
              </button>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                aria-label={`„${prompt.title}“ umbenennen`}
                title="Umbenennen"
                className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {canExportPdf && (
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  aria-label="Als PDF exportieren"
                  title="Als PDF exportieren"
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <FileDown className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Prompt löschen"
                title="Löschen"
                className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kein Spinner: nach der Bestaetigung verschwindet die Karte sofort aus
          der Liste, es bleibt also nichts uebrig, das drehen koennte. */}
      <ConfirmDialog
        open={confirmingDelete}
        title="Prompt löschen?"
        description={`„${prompt.title}“ wird endgültig entfernt. Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        busyLabel="Wird gelöscht…"
        onConfirm={() => {
          setConfirmingDelete(false);
          void remove();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </article>
  );
}

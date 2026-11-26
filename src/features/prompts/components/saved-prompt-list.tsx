"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Check, X, Trash2, FileDown, Pencil, SquarePen } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";
import { cn, relativeTime } from "@/shared/lib/utils";
import type { SavedPrompt } from "@/shared/lib/saved-prompts";
import type { PlaceholderFill } from "@/shared/lib/placeholders";
import { useLocale, useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { PlaceholderForm } from "@/shared/ui/placeholder-form";
import { SharePrompt } from "@/features/prompts/components/share-prompt";
import { PromptReuseBar } from "@/features/prompts/components/prompt-reuse-bar";
import { PromptTextEditor } from "@/features/prompts/components/prompt-text-editor";
import { PromptHistory } from "@/features/prompts/components/prompt-history";
import { useShareStatus } from "@/features/prompts/hooks/use-share-status";

/** Ein gespeicherter Prompt in der Liste, mit dem Projekt, in dem ein neuer Chat ihn als Ausgangspunkt nimmt. */
export type ListedPrompt = SavedPrompt & { projectId?: string | null };

// Die Liste der gespeicherten Prompts, neueste zuerst. Zugeklappt steht nur der Titel (beim Speichern aus der ersten
// Zeile, umbenennbar), aufgeklappt der Text mit Kopieren, Umbenennen, Text bearbeiten, PDF und Löschen, darunter
// Wiederverwenden, Verlauf und Teilen. Geschrieben wird mit dem Browser-Client unter RLS und zusätzlich `user_id`;
// ein neuer Text wird in der Datenbank zur nächsten Version (Migration 0061), der Verlauf steht in prompt-history.tsx.
export function SavedPromptList({
  prompts,
  userId,
}: {
  prompts: ListedPrompt[];
  /** Owner, fuer das explizite user_id neben RLS (Defense-in-depth). */
  userId: string;
}) {
  const [items, setItems] = useState(prompts);

  // Löschen und Umbenennen wirken sofort und geben ihr Rückgängig zurück; ein gelöschter Prompt kommt an seinen Platz zurück.
  const removeAt = (id: string) => {
    let removed: { item: ListedPrompt; index: number } | null = null;
    setItems((list) => {
      const index = list.findIndex((it) => it.id === id);
      if (index === -1) return list;
      removed = { item: list[index], index };
      return list.filter((it) => it.id !== id);
    });
    return () => {
      const r = removed as { item: ListedPrompt; index: number } | null;
      if (!r) return;
      setItems((list) => {
        const next = list.slice();
        next.splice(Math.min(r.index, next.length), 0, r.item);
        return next;
      });
    };
  };

  // Bearbeiten und Wiederherstellen setzen den Text erst, wenn er geschrieben ist (der Verlauf lädt dann nach).
  const changeText = (id: string, content: string) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, content } : it)));

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
            onDelete={() => removeAt(p.id)}
            onRename={(title) => renameTo(p.id, title)}
            onTextChange={(content) => changeText(p.id, content)}
          />
        </li>
      ))}
    </ul>
  );
}

function SavedPromptCard({
  prompt,
  userId,
  onDelete,
  onRename,
  onTextChange,
}: {
  prompt: ListedPrompt;
  userId: string;
  /** Applies the removal immediately and returns the undo for a failed write. */
  onDelete: () => () => void;
  /** Applies the new title immediately and returns the undo for a failed write. */
  onRename: (title: string) => () => void;
  /** Sets a new text (edited or restored) once it is written. */
  onTextChange: (content: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(prompt.title);
  // Was im Formular der Platzhalter steht, nimmt der Export mit.
  const [fill, setFill] = useState<PlaceholderFill>();
  // Löschen fragt nach, wie bei Projekt, Datei und Gedächtnis.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Ob der Prompt geteilt ist: einmal je Aufklappen geladen, für Teilen, Bearbeiten und Verlauf derselbe Stand.
  const { share, setShare, reload: reloadShare } = useShareStatus(prompt.id, open);

  async function exportPdf() {
    const { downloadMarkdownAsPdf } = await import("@/features/prompts/lib/pdf-export");
    downloadMarkdownAsPdf(`${prompt.title}.pdf`, prompt.title, prompt.content);
  }

  function cancelRename() {
    setTitle(prompt.title);
    setRenaming(false);
  }

  // Umbenennen und Löschen sind optimistisch: die Liste ändert sich sofort, ein Fehler nimmt es zurück und sagt es.
  async function rename() {
    const next = title.trim().slice(0, 80);
    if (!next || next === prompt.title) {
      cancelRename();
      return;
    }
    setRenaming(false);
    const undo = onRename(next);

    const supabase = createClient();
    // outputs ist eine JSONB-Spalte (prompt, title): der Text kommt aus dem Speicher der Karte mit.
    const { error } = await supabase
      .from("saved_prompts")
      .update({
        outputs: {
          prompt: prompt.content,
          title: next,
        },
      })
      .eq("id", prompt.id)
      .eq("user_id", userId);
    if (error) {
      // Titel zurück, aber das Feld mit dem Getippten wieder öffnen, damit ein Fehler die Eingabe nicht kostet.
      undo();
      setTitle(next);
      setRenaming(true);
      toast({
        title: t.prompts.renameFailed,
        description: t.prompts.tryAgain,
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
      .from("saved_prompts")
      .delete()
      .eq("id", prompt.id)
      .eq("user_id", userId);
    if (error) {
      undo();
      toast({
        title: t.prompts.deleteFailed,
        description: t.prompts.deleteFailedBody,
        variant: "error",
      });
      return;
    }
    toast({ title: t.prompts.deleted, variant: "success" });
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
            aria-label={t.prompts.newNameLabel}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void rename();
              } else if (e.key === "Escape") {
                cancelRename();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[13.5px] text-foreground transition-colors focus:border-ring focus:outline-hidden focus:ring-2 focus:ring-ring/20"
          />
          {/* No pending/disabled state on either button: the rename closes
              the editor and updates the title on click, there is no in-flight
              window left to guard. */}
          <button
            type="button"
            onClick={() => void rename()}
            aria-label={t.prompts.saveName}
            className="touch-hit-y relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={cancelRename}
            aria-label={t.prompts.cancelRename}
            className="touch-hit-y relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
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
            className="flex w-full min-w-0 items-center gap-2.5 px-4 py-3 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
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
          {editing ? (
            <PromptTextEditor
              promptId={prompt.id}
              userId={userId}
              title={prompt.title}
              content={prompt.content}
              share={share}
              onSaved={onTextChange}
              onClose={() => setEditing(false)}
            />
          ) : (
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
              {prompt.content}
            </pre>
          )}
          {/* Dasselbe Formular wie im Chat. Kopieren in der Leiste darunter nimmt weiter den gespeicherten Text, die
              ausgefüllte Fassung kopiert der Knopf im Formular. */}
          <PlaceholderForm
            prompt={prompt.content}
            hint={t.chat.fill.hintSaved}
            onFillChange={setFill}
            className="md:px-4"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
            <span className="px-1 text-[12px] text-tertiary">
              {fmt(t.prompts.savedAgo, {
                time: relativeTime(prompt.createdAt, LOCALE_TAGS[locale].intl, t.time.justNow),
              })}
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
                {copied ? t.common.copied : t.common.copy}
              </button>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                aria-label={fmt(t.prompts.renameLabel, { title: prompt.title })}
                title={t.common.rename}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={editing}
                aria-label={fmt(t.prompts.edit.label, { title: prompt.title })}
                title={t.prompts.edit.open}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
              >
                <SquarePen className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                aria-label={t.prompts.exportPdf}
                title={t.prompts.exportPdf}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <FileDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label={t.prompts.deleteLabel}
                title={t.common.delete}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-tertiary transition-colors hover:bg-surface-hover hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <PromptReuseBar
            promptId={prompt.id}
            title={prompt.title}
            content={prompt.content}
            projectId={prompt.projectId}
            fill={fill}
          />
          <PromptHistory
            promptId={prompt.id}
            userId={userId}
            title={prompt.title}
            content={prompt.content}
            share={share}
            onRestored={onTextChange}
          />
          {/* Teilen per Link (Migration 0057): erst nach einer Rückfrage, widerrufbar. */}
          <SharePrompt
            promptId={prompt.id}
            content={prompt.content}
            share={share}
            onShareChange={setShare}
            onReload={reloadShare}
          />
        </div>
      )}

      {/* Kein Spinner: nach der Bestaetigung verschwindet die Karte sofort aus
          der Liste, es bleibt also nichts uebrig, das drehen koennte. */}
      <ConfirmDialog
        open={confirmingDelete}
        title={t.prompts.deleteConfirmTitle}
        description={fmt(t.prompts.deleteConfirmBody, { title: prompt.title })}
        confirmLabel={t.prompts.deleteConfirm}
        busyLabel={t.common.deleting}
        onConfirm={() => {
          setConfirmingDelete(false);
          void remove();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </article>
  );
}

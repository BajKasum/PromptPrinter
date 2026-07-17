"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Trash2, FileDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { relativeTime } from "@/lib/utils";
import type { SavedPrompt } from "@/lib/saved-prompts";

// The Ergebnisse list: one card per saved prompt, newest first. Each card is a
// read-and-reuse unit, copy the prompt, export it as PDF (Pro), or delete it.
// Delete goes through the RLS-scoped browser client (owner-only delete policy,
// migration 0018) and drops the row optimistically, then refreshes so the
// project's result counters update. No editing: a saved prompt is an immutable
// snapshot; to change one, save a fresh version from the chat.
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
        />
      ))}
    </div>
  );
}

function SavedPromptCard({
  prompt,
  canExportPdf,
  onDeleted,
}: {
  prompt: SavedPrompt;
  canExportPdf: boolean;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const [deleting, setDeleting] = useState(false);

  // jsPDF is ~130 kB; load it only when the user actually exports, so it never
  // weighs down the initial Ergebnisse bundle.
  async function exportPdf() {
    const { downloadMarkdownAsPdf } = await import("@/lib/pdf-export");
    downloadMarkdownAsPdf(`${prompt.title}.pdf`, prompt.title, prompt.content);
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
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-medium text-foreground">{prompt.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-foreground/50">
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground"
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
              className="inline-flex items-center justify-center rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <FileDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
            aria-label="Prompt löschen"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-surface-hover hover:text-destructive disabled:opacity-60"
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

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, NotebookPen, Layers, Sparkles } from "lucide-react";
import { Label } from "@/shared/ui/label";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/utils";
import { ProjectFiles } from "@/features/projects/components/project-files";
import type { ProjectFile } from "@/features/projects/lib/project-files";

// The workspace context rail (REDESIGN.md, Phase 3+4): the living briefing of
// a project. Anweisungen (free text) and Struktur (fixed optional fields)
// save on blur via the browser client (RLS scopes writes to the owner),
// every project chat reads them server-side on the next turn, so there is
// nothing to sync beyond the DB row. Dateien (Phase 4) is a real upload list,
// injected into chats by buildProjectContext; Ergebnisse is a status card
// linking to the results area.

const STRUCTURE_FIELDS = [
  { key: "target", label: "Ziel-KI", placeholder: "z. B. Claude, Cursor, Lovable" },
  { key: "frontend", label: "Frontend", placeholder: "z. B. Next.js, React" },
  { key: "backend", label: "Backend", placeholder: "z. B. Supabase, Node.js" },
  { key: "language", label: "Sprache", placeholder: "z. B. TypeScript, Python" },
  { key: "database", label: "Datenbank", placeholder: "z. B. Postgres, Supabase" },
  { key: "notes", label: "Weiteres", placeholder: "Was ich sonst wissen sollte" },
] as const;

const INSTRUCTIONS_MAX = 4000;

type SaveState = "idle" | "saving" | "saved" | "error";

export function ProjectRail({
  projectId,
  initialInstructions,
  initialContext,
  files,
  resultCount,
  latestResultAt,
}: {
  projectId: string;
  initialInstructions: string | null;
  initialContext: Record<string, string>;
  files: ProjectFile[];
  resultCount: number;
  latestResultAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [instructions, setInstructions] = useState(initialInstructions ?? "");
  const [context, setContext] = useState<Record<string, string>>(initialContext);
  // Anweisungen and Struktur save independently, editing one no longer
  // fires a write of the other's last-known value just because they used to
  // share one persist() call. Each keeps its own in-flight indicator and its
  // own "did this actually change" snapshot.
  const [instructionsSaveState, setInstructionsSaveState] = useState<SaveState>("idle");
  const [contextSaveState, setContextSaveState] = useState<SaveState>("idle");
  const persistedInstructions = useRef(initialInstructions ?? "");
  const persistedContext = useRef(initialContext);

  async function persistInstructions(next: string) {
    const trimmed = next.trim();
    if (trimmed === persistedInstructions.current.trim()) return;

    setInstructionsSaveState("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ instructions: trimmed.length > 0 ? trimmed : null })
      .eq("id", projectId);
    if (error) {
      setInstructionsSaveState("error");
      toast({
        title: "Speichern fehlgeschlagen",
        description: "Deine Anweisungen konnten nicht gespeichert werden.",
        variant: "error",
      });
      return;
    }
    persistedInstructions.current = trimmed;
    setInstructionsSaveState("saved");
    window.setTimeout(
      () => setInstructionsSaveState((s) => (s === "saved" ? "idle" : s)),
      2000
    );
    router.refresh();
  }

  async function persistContext(nextContext: Record<string, string>) {
    const cleanContext: Record<string, string> = {};
    for (const [k, v] of Object.entries(nextContext)) {
      if (v.trim().length > 0) cleanContext[k] = v.trim();
    }
    if (JSON.stringify(cleanContext) === JSON.stringify(persistedContext.current)) return;

    setContextSaveState("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ context: cleanContext })
      .eq("id", projectId);
    if (error) {
      setContextSaveState("error");
      toast({
        title: "Speichern fehlgeschlagen",
        description: "Deine Struktur-Angaben konnten nicht gespeichert werden.",
        variant: "error",
      });
      return;
    }
    persistedContext.current = cleanContext;
    setContextSaveState("saved");
    window.setTimeout(() => setContextSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    router.refresh();
  }

  return (
    <aside className="space-y-4" aria-label="Projekt-Kontext">
      <section className="card-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <NotebookPen className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
            Anweisungen
          </h2>
          <SaveIndicator state={instructionsSaveState} />
        </div>
        <textarea
          value={instructions}
          maxLength={INSTRUCTIONS_MAX}
          rows={5}
          placeholder="Wie soll dein Prompt aussehen? Ton, Format, Ziel. Ich richte mich in jedem Chat dieses Projekts danach."
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={() => void persistInstructions(instructions)}
          aria-label="Projekt-Anweisungen"
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </section>

      <section className="card-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Layers className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
            Struktur
          </h2>
          <SaveIndicator state={contextSaveState} />
        </div>
        <div className="space-y-2.5">
          {STRUCTURE_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="grid grid-cols-[88px_1fr] items-center gap-2">
              <Label htmlFor={`ctx-${key}`} className="text-[12px] text-muted-foreground">
                {label}
              </Label>
              <input
                id={`ctx-${key}`}
                value={context[key] ?? ""}
                maxLength={120}
                placeholder={placeholder}
                onChange={(e) => setContext((c) => ({ ...c, [key]: e.target.value }))}
                onBlur={() => void persistContext(context)}
                className="h-8 w-full rounded-md border border-border bg-surface px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          ))}
        </div>
        {/* Only before anything's filled in, once a field carries content,
            "alles optional" has already been learned by using it. */}
        {Object.values(context).every((v) => !v?.trim()) && (
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground/70">
            Alles optional, was du ausfüllst, kennt jeder Chat in diesem Projekt.
          </p>
        )}
      </section>

      <ProjectFiles projectId={projectId} initialFiles={files} />

      <Link
        href={`/projects/${projectId}/results`}
        className="card-surface group flex items-center justify-between gap-3 p-4 transition-colors hover:border-border-strong"
      >
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Sparkles className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
            Ergebnisse
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {resultCount === 0
              ? "Noch keine gespeichert"
              : `${resultCount} ${resultCount === 1 ? "Prompt" : "Prompts"}${
                  latestResultAt ? ` · zuletzt ${latestResultAt}` : ""
                }`}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </aside>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 text-[11px]",
        state === "error" ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === "saved" && <Check className="h-3 w-3 text-success" />}
      {state === "saving" ? "Speichert…" : state === "saved" ? "Gespeichert" : "Fehler"}
    </span>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileText, Loader2, NotebookPen, Layers, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// The workspace context rail (REDESIGN.md, Phase 3): the living briefing of a
// project. Anweisungen (free text) and Struktur (fixed optional fields) save
// on blur via the browser client (RLS scopes writes to the owner) — every
// project chat reads them server-side on the next turn, so there is nothing
// to sync beyond the DB row. Dateien is a deliberate placeholder until
// Phase 4; Ergebnisse is a status card linking to the results area.

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
  resultCount,
  latestResultAt,
}: {
  projectId: string;
  initialInstructions: string | null;
  initialContext: Record<string, string>;
  resultCount: number;
  latestResultAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [instructions, setInstructions] = useState(initialInstructions ?? "");
  const [context, setContext] = useState<Record<string, string>>(initialContext);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Compare against the last persisted snapshot so blur without changes
  // doesn't fire a write (and updated_at doesn't churn the sidebar recents).
  const persisted = useRef({ instructions: initialInstructions ?? "", context: initialContext });

  async function persist(nextInstructions: string, nextContext: Record<string, string>) {
    const cleanContext: Record<string, string> = {};
    for (const [k, v] of Object.entries(nextContext)) {
      if (v.trim().length > 0) cleanContext[k] = v.trim();
    }
    const trimmed = nextInstructions.trim();
    const prev = persisted.current;
    if (
      trimmed === prev.instructions.trim() &&
      JSON.stringify(cleanContext) === JSON.stringify(prev.context)
    ) {
      return;
    }

    setSaveState("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ instructions: trimmed.length > 0 ? trimmed : null, context: cleanContext })
      .eq("id", projectId);
    if (error) {
      setSaveState("error");
      toast({
        title: "Speichern fehlgeschlagen",
        description: "Deine Änderung am Briefing konnte nicht gespeichert werden.",
        variant: "error",
      });
      return;
    }
    persisted.current = { instructions: trimmed, context: cleanContext };
    setSaveState("saved");
    window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
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
          <SaveIndicator state={saveState} />
        </div>
        <textarea
          value={instructions}
          maxLength={INSTRUCTIONS_MAX}
          rows={5}
          placeholder="Wie soll dein Prompt aussehen? Ton, Format, Ziel — ich richte mich in jedem Chat dieses Projekts danach."
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={() => void persist(instructions, context)}
          aria-label="Projekt-Anweisungen"
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </section>

      <section className="card-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Layers className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
          Struktur
        </h2>
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
                onBlur={() => void persist(instructions, context)}
                className="h-8 w-full rounded-md border border-border bg-surface px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground/70">
          Alles optional — was du ausfüllst, kennt jeder Chat in diesem Projekt.
        </p>
      </section>

      <section className="card-surface p-4 opacity-70">
        <h2 className="mb-1 flex items-center gap-2 text-[13px] font-medium text-foreground">
          <FileText className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
          Dateien
        </h2>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Bald legst du hier Kontext-Dateien ab — am besten <code className="rounded bg-accent-subtle px-1 py-0.5 font-mono text-[11px] text-accent-text">.md</code>, das ist token-effizient.
        </p>
      </section>

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
              : `${resultCount} ${resultCount === 1 ? "Lauf" : "Läufe"}${
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

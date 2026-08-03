"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Brain, Github, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Mascot } from "@/shared/brand/mascot";
import { useToast } from "@/shared/ui/toast";
import { cn, relativeTime } from "@/shared/lib/utils";
import {
  BRAIN_FIELDS,
  isAnalysisRunning,
  isBrainStale,
  type ProjectBrain,
} from "@/shared/lib/project-brain";

// Die Kontext-Rail-Karte des Projekt-Gedächtnisses.
//
// Anders als „Anweisungen" und „Struktur" daneben schreibt diese Karte nicht
// direkt über den Browser-Client in die Datenbank: project_brains hat nur ein
// select-Grant (migration 0037), alles Schreibende läuft über
// /api/projects/[id]/brain. Das ist genau die Grenze, die den Wert der
// Tabelle ausmacht — die Fakten stammen aus echten Quellen, nicht aus einer
// Behauptung des Clients.

/** Fehlercodes der Route in Text, den ein Mensch lesen will. */
const ERROR_TEXTS: Record<string, string> = {
  repo_not_found: "Das Repository konnte ich nicht lesen. Ist es öffentlich und die Adresse richtig?",
  repo_rate_limited: "GitHub lässt gerade keine weiteren Abfragen zu. In einer Stunde nochmal.",
  repo_empty: "In dem Repository sind keine analysierbaren Dateien.",
  repo_unavailable: "GitHub war nicht erreichbar. Versuch es in ein paar Minuten nochmal.",
  repo_invalid_url: "Das sieht nicht nach einem öffentlichen GitHub-Repository aus.",
  analysis_no_sources: "Noch nichts zu analysieren. Lade Dateien hoch oder hinterlege ein Repository.",
  analysis_unparsable: "Da kam kein verwertbares Ergebnis zurück. Versuch es nochmal.",
};

function errorText(code: string | null): string {
  if (!code) return "Die Analyse ist fehlgeschlagen. Versuch es nochmal.";
  return ERROR_TEXTS[code] ?? "Die Analyse ist fehlgeschlagen. Versuch es nochmal.";
}

const CONFIDENCE_LABELS = {
  high: "gut belegt",
  medium: "grösstenteils belegt",
  low: "unsicher",
} as const;

export function ProjectBrainCard({
  projectId,
  brain,
  currentDigest,
  sourceCount,
}: {
  projectId: string;
  brain: ProjectBrain;
  /** Fingerabdruck der Quellen JETZT, für „hat sich seither etwas geändert?". */
  currentDigest: string;
  /** Dateien + ggf. Repo, entscheidet ob es überhaupt etwas zu analysieren gibt. */
  sourceCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [repoUrl, setRepoUrl] = useState(brain.repoUrl ?? "");
  // Der Serverstatus regiert, solange die Seite frisch ist; `busy` deckt nur
  // das Fenster zwischen Klick und router.refresh() ab.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const running = busy || isAnalysisRunning(brain);
  const stale = isBrainStale(brain, currentDigest);
  const ready = brain.status === "ready";
  const hasSources = sourceCount > 0 || repoUrl.trim().length > 0;

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/brain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() || null }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          code?: string;
          detail?: string;
        };
        // `detail` ist bereits serverseitig übersetzt und leckt nichts (M-1),
        // `code` nur als Rückfallebene, falls eine Antwort ohne detail kommt.
        setError(body.detail ?? errorText(body.code ?? null));
        return;
      }

      toast({
        title: "Gedächtnis aktualisiert",
        description: "Jeder Chat in diesem Projekt kennt den Stack jetzt.",
        variant: "success",
      });
      router.refresh();
    } catch {
      setError("Die Analyse konnte nicht gestartet werden. Bist du online?");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setConfirmReset(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/brain`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setRepoUrl("");
      router.refresh();
    } catch {
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Bitte versuch es erneut.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-surface p-4" aria-label="Projekt-Gedächtnis">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Brain className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.8} />
          Gedächtnis
        </h2>
        {ready && !running && (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            aria-label="Gedächtnis löschen"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {running ? (
        <div className="flex items-center gap-3 py-1">
          {/* Finn liest sich ein — derselbe State wie beim Recherchieren. */}
          <Mascot state="researching" size={36} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-foreground">Ich lese mich gerade ein…</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Dauert je nach Projektgrösse ein paar Sekunden.
            </p>
          </div>
        </div>
      ) : ready ? (
        <BrainFacts brain={brain} />
      ) : (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Ich lese deine Dateien und dein Repository einmal durch und merke mir Framework,
          Sprache, Architektur, Datenbank, Design und Konventionen. Danach kennt jeder Chat in
          diesem Projekt deinen Stack, ohne dass du ihn erklärst.
        </p>
      )}

      {stale && !running && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-accent-subtle px-2.5 py-2 text-[11.5px] leading-relaxed text-accent-text">
          <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          Seit der Analyse haben sich deine Quellen geändert.
        </p>
      )}

      {brain.status === "failed" && !running && (
        <p
          role="status"
          className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          {errorText(brain.errorCode)}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <label
          htmlFor="brain-repo"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
        >
          <Github className="h-3.5 w-3.5" strokeWidth={1.8} />
          GitHub-Repository, optional
        </label>
        <input
          id="brain-repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          disabled={running}
          maxLength={300}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="github.com/name/projekt"
          className="h-8 w-full rounded-md border border-border bg-surface px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
        />
        {/* Nur oeffentliche Repos: alles andere braeuchte dauerhaften Zugriff
            auf fremden Quellcode auf dem Server, das ist eine eigene
            Vertrauensfrage und keine Erweiterung dieses Feldes. */}
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Muss öffentlich sein. Private Repos: lade die wichtigen Dateien hoch.
        </p>
      </div>

      <Button
        variant={ready ? "ghost" : "accent"}
        size="sm"
        onClick={() => void analyze()}
        disabled={running || !hasSources}
        className="mt-3 w-full"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : ready ? (
          <RefreshCw className="h-3.5 w-3.5" />
        ) : (
          <Brain className="h-3.5 w-3.5" />
        )}
        {running ? "Analysiere…" : ready ? "Neu analysieren" : "Projekt analysieren"}
      </Button>

      {!hasSources && !running && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground/70">
          Lade zuerst Dateien hoch oder trag ein Repository ein.
        </p>
      )}

      {error && (
        <p role="status" className="mt-2 text-[11.5px] leading-relaxed text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Gedächtnis löschen?"
        description="Deine Dateien und das Repository bleiben. Nur was ich daraus gelernt habe, wird verworfen — die Chats dieses Projekts kennen deinen Stack danach nicht mehr."
        confirmLabel="Gedächtnis löschen"
        busyLabel="Wird gelöscht…"
        busy={false}
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}

/** Das Ergebnis einer fertigen Analyse. */
function BrainFacts({ brain }: { brain: ProjectBrain }) {
  const { facts } = brain;
  const fields = BRAIN_FIELDS.filter(({ key }) => {
    const value = facts[key];
    return typeof value === "string" && value.length > 0;
  });

  return (
    <div className="space-y-2.5">
      {facts.summary && (
        <p className="text-[12.5px] leading-relaxed text-foreground/90">{facts.summary}</p>
      )}

      {fields.length > 0 && (
        <dl className="space-y-1">
          {fields.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-[92px_1fr] gap-2">
              <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
              <dd className="text-[11.5px] text-foreground/85">{facts[key] as string}</dd>
            </div>
          ))}
        </dl>
      )}

      {facts.stack.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {facts.stack.map((item) => (
            <li
              key={item}
              className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/75"
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {/* Die Selbsteinschaetzung des Modells sichtbar lassen: ein aus einer
          einzigen README abgeleitetes Ergebnis soll nicht so aussehen wie
          eines aus package.json plus Migrationen. */}
      <p className="text-[11px] text-muted-foreground/70">
        {brain.sources.length} {brain.sources.length === 1 ? "Quelle" : "Quellen"}
        <span className={cn(facts.confidence === "low" && "text-destructive/80")}>
          {" · "}
          {CONFIDENCE_LABELS[facts.confidence]}
        </span>
        {brain.analyzedAt ? ` · ${relativeTime(brain.analyzedAt)}` : ""}
      </p>
    </div>
  );
}

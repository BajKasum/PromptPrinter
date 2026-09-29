"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Brain,
  ChevronRight,
  Github,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import { useLocale, useT } from "@/shared/i18n/provider";
import { plural } from "@/shared/i18n/format";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import type { Messages } from "@/shared/i18n/messages/de";

// Die Kontext-Rail-Karte des Projekt-Gedächtnisses.
//
// Seit 23.09.2026 die ERSTE Karte der Rail und optisch hervorgehoben (Audit
// 23.09.2026, P-3): sie stand vorher als vierte Karte ganz unten, unter
// Anweisungen, Struktur und Dateien, und war damit das am wenigsten sichtbare
// Element — ausgerechnet das Feature, das PromptPrinter von einem normalen
// Chat unterscheidet. Weil sie jetzt oben sitzt, bleibt sie im fertigen
// Zustand kompakt (Zusammenfassung und Stack), die Einzelfelder klappen unter
// "Details" auf, damit sie die Anweisungen nicht nach unten schiebt.
//
// Anders als „Anweisungen" und „Struktur" schreibt diese Karte nicht direkt
// über den Browser-Client in die Datenbank: project_brains hat nur ein
// select-Grant (migration 0037), alles Schreibende läuft über
// /api/projects/[id]/brain. Das ist genau die Grenze, die den Wert der
// Tabelle ausmacht — die Fakten stammen aus echten Quellen, nicht aus einer
// Behauptung des Clients.

/** Fehlercodes der Route in Text, den ein Mensch lesen will. */
function errorText(code: string | null, m: Messages["projects"]["brain"]): string {
  const errors: Record<string, string> = m.errors;
  return (code && errors[code]) || m.failed;
}

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
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();

  const [repoUrl, setRepoUrl] = useState(brain.repoUrl ?? "");
  // Der Serverstatus regiert, solange die Seite frisch ist; `busy` deckt nur
  // das Fenster zwischen Klick und router.refresh() ab.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Fuer die ANZEIGE (Panel, Hinweise): "sieht nach einer laufenden Analyse
  // aus", bleibt bis zu BRAIN_ANALYZING_TIMEOUT_MS (10 Minuten) stehen, auch
  // wenn der Request laengst abgerissen ist — rein informativ, klaert sich
  // von selbst, sobald das Fenster ablaeuft oder die Seite neu laedt.
  const running = busy || isAnalysisRunning(brain);
  // M-12 (Audit 06.09.2026): NUR fuer Eingabefeld und Knopf — die Route
  // selbst prueft den Status nie und erlaubt "Neu analysieren" bewusst
  // jederzeit (kein Job-System im Projekt, siehe brain/route.ts). Der Knopf
  // haengte bisher trotzdem an `running` und blieb dadurch bis zu 10 Minuten
  // gesperrt, nachdem ein Request abgerissen war — obwohl ein sofortiger
  // neuer Versuch laengst wieder funktioniert haette, und alle Projekt-Chats
  // in der Zwischenzeit ohne Gedaechtnis liefen.
  const blocked = busy;
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
        setError(body.detail ?? errorText(body.code ?? null, t.projects.brain));
        return;
      }

      toast({
        title: t.projects.brain.updated,
        description: t.projects.brain.updatedBody,
        variant: "success",
      });
      router.refresh();
    } catch {
      setError(t.projects.brain.startFailed);
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
        title: t.projects.deleteFailed,
        description: t.projects.tryAgain,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-accent/30 bg-surface-raised p-4"
      aria-label={t.projects.brain.label}
    >
      {/* Ein leiser Akzentschimmer oben, damit die Karte als das Besondere
          dieser Rail lesbar ist, ohne laut zu werden (DESIGN.md: felt, not
          seen). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-accent-subtle to-transparent"
      />

      <div className="relative">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent-text">
              <Brain className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            {t.projects.brain.title}
            <BrainStatus ready={ready} stale={stale} running={running} />
          </h2>
          {ready && !running && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              aria-label={t.projects.brain.delete}
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
              <p className="text-[12.5px] text-foreground">{t.projects.brain.reading}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {t.projects.brain.readingHint}
              </p>
            </div>
          </div>
        ) : ready ? (
          <BrainFacts brain={brain} />
        ) : (
          <div className="flex items-start gap-3">
            <Mascot state="curious" size={36} className="shrink-0" />
            <p className="text-[12px] leading-relaxed text-secondary">
              {t.projects.brain.emptyHint}
            </p>
          </div>
        )}

        {stale && !running && (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-accent-subtle px-2.5 py-2 text-[11.5px] leading-relaxed text-accent-text">
            <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            {t.projects.brain.staleHint}
          </p>
        )}

        {brain.status === "failed" && !running && (
          <p
            role="status"
            className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            {errorText(brain.errorCode, t.projects.brain)}
          </p>
        )}

        <div className="mt-3 space-y-2">
          <label
            htmlFor="brain-repo"
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
          >
            <Github className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t.projects.brain.repoLabel}
          </label>
          <input
            id="brain-repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={blocked}
            maxLength={300}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={t.projects.brain.repoPlaceholder}
            className="h-8 w-full rounded-md border border-border bg-surface px-2.5 text-[12.5px] text-foreground placeholder:text-tertiary transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
          />
          {/* Nur oeffentliche Repos: alles andere braeuchte dauerhaften Zugriff
              auf fremden Quellcode auf dem Server, das ist eine eigene
              Vertrauensfrage und keine Erweiterung dieses Feldes. */}
          <p className="text-[11px] leading-relaxed text-secondary">
            {t.projects.brain.repoHint}
          </p>
        </div>

        <Button
          // Vor der ersten Analyse und bei veralteten Quellen ist das DIE
          // Aktion der Karte, sonst ein ruhiges Nachladen.
          variant={ready && !stale ? "ghost" : "accent"}
          size="sm"
          onClick={() => void analyze()}
          disabled={blocked || !hasSources}
          className="mt-3 w-full"
        >
          {blocked ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : ready ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Brain className="h-3.5 w-3.5" />
          )}
          {blocked
            ? t.projects.brain.analyzing
            : ready
              ? t.projects.brain.reanalyze
              : t.projects.brain.analyze}
        </Button>

        {!hasSources && !blocked && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-secondary">
            {t.projects.brain.noSources}
          </p>
        )}

        {error && (
          <p role="status" className="mt-2 text-[11.5px] leading-relaxed text-destructive">
            {error}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={t.projects.brain.deleteConfirmTitle}
        description={t.projects.brain.deleteConfirmBody}
        confirmLabel={t.projects.brain.delete}
        busyLabel={t.common.deleting}
        busy={false}
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}

/** Kleine Statusmarke neben der Überschrift. */
function BrainStatus({
  ready,
  stale,
  running,
}: {
  ready: boolean;
  stale: boolean;
  running: boolean;
}) {
  const t = useT();
  if (running || !ready) return null;
  return stale ? (
    <span className="rounded-full bg-accent/15 px-1.5 py-px text-[10.5px] font-medium text-accent-text">
      {t.projects.brain.stale}
    </span>
  ) : (
    <span className="rounded-full bg-success/15 px-1.5 py-px text-[10.5px] font-medium text-success">
      {t.projects.brain.active}
    </span>
  );
}

/** Das Ergebnis einer fertigen Analyse: kompakt, Einzelfelder auf Wunsch. */
function BrainFacts({ brain }: { brain: ProjectBrain }) {
  const t = useT();
  const locale = useLocale();
  const { facts } = brain;
  const detailsId = useId();
  const [showDetails, setShowDetails] = useState(false);
  const fields = BRAIN_FIELDS.filter(({ key }) => {
    const value = facts[key];
    return typeof value === "string" && value.length > 0;
  });

  return (
    <div className="space-y-2.5">
      {facts.summary && (
        <p className="text-[12.5px] leading-relaxed text-foreground/90">{facts.summary}</p>
      )}

      {facts.stack.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={t.projects.brain.stack}>
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

      {fields.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            aria-controls={detailsId}
            className="inline-flex items-center gap-1 rounded text-[11.5px] text-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform duration-150", showDetails && "rotate-90")}
              strokeWidth={2}
            />
            {t.projects.brain.details}
          </button>
          {showDetails && (
            <dl id={detailsId} className="mt-1.5 space-y-1">
              {fields.map(({ key }) => (
                <div key={key} className="grid grid-cols-[92px_1fr] gap-2">
                  <dt className="text-[11.5px] text-muted-foreground">
                    {t.projects.brain.fields[key]}
                  </dt>
                  <dd className="text-[11.5px] text-foreground/85">{facts[key] as string}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Die Selbsteinschaetzung des Modells sichtbar lassen: ein aus einer
          einzigen README abgeleitetes Ergebnis soll nicht so aussehen wie
          eines aus package.json plus Migrationen. */}
      <p className="text-[11px] text-secondary">
        {plural(t.projects.brain.sources, brain.sources.length, locale)}
        <span className={cn(facts.confidence === "low" && "text-destructive/80")}>
          {" · "}
          {t.projects.brain.confidence[facts.confidence]}
        </span>
        {brain.analyzedAt
          ? ` · ${relativeTime(brain.analyzedAt, LOCALE_TAGS[locale].intl, t.time.justNow)}`
          : ""}
      </p>
    </div>
  );
}

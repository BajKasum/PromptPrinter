"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn, relativeTime } from "@/shared/lib/utils";
import { BRAIN_FIELDS, type ProjectBrain } from "@/shared/lib/project-brain";
import { useLocale, useT } from "@/shared/i18n/provider";
import { plural } from "@/shared/i18n/format";
import { LOCALE_TAGS } from "@/shared/i18n/locales";

// Die Anzeige in der Karte des Projekt-Gedächtnisses (project-brain.tsx): die Statusmarke neben
// der Überschrift und das Ergebnis einer fertigen Analyse. Reine Darstellung, kein Zustand der Karte.

/** Kleine Statusmarke neben der Überschrift. */
export function BrainStatus({
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
    <span className="rounded-full bg-accent/15 px-1.5 py-px text-[12px] font-medium text-accent-text">
      {t.projects.brain.stale}
    </span>
  ) : (
    <span className="rounded-full bg-success/15 px-1.5 py-px text-[12px] font-medium text-success">
      {t.projects.brain.active}
    </span>
  );
}

/** Das Ergebnis einer fertigen Analyse: kompakt, Einzelfelder auf Wunsch. */
export function BrainFacts({ brain }: { brain: ProjectBrain }) {
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

      {facts.keyFacts.length > 0 && (
        <ul className="space-y-1" aria-label={t.projects.brain.keyFacts}>
          {facts.keyFacts.map((item) => (
            <li key={item} className="flex gap-1.5 text-[12px] leading-relaxed text-foreground/85">
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {facts.stack.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={t.projects.brain.stack}>
          {facts.stack.map((item) => (
            <li
              key={item}
              className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-foreground/75"
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
            className="touch-hit-y relative inline-flex items-center gap-1 rounded text-[12px] text-secondary transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
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
                  <dt className="text-[12px] text-muted-foreground">
                    {t.projects.brain.fields[key]}
                  </dt>
                  <dd className="text-[12px] text-foreground/85">{facts[key] as string}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Die Selbsteinschaetzung des Modells sichtbar lassen: ein aus einer
          einzigen README abgeleitetes Ergebnis soll nicht so aussehen wie
          eines aus package.json plus Migrationen. */}
      <p className="text-[12px] text-secondary">
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

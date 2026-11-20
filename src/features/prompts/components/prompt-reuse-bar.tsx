"use client";

import { useId, useState } from "react";
import { Code2, MessageSquarePlus } from "lucide-react";
import { HoverPrefetchLink } from "@/shared/ui/hover-prefetch-link";
import { startFromHref, startFromText } from "@/shared/lib/start-from-prompt";
import type { PlaceholderFill } from "@/shared/lib/placeholders";
import { PromptExportPanel } from "@/features/prompts/components/prompt-export-panel";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";

// Weiterverwenden eines gespeicherten Prompts, als eigene Leiste unter Kopieren, Umbenennen, PDF und Löschen.
// "Als Ausgangspunkt nutzen" öffnet einen neuen Chat (im Projekt des Prompts, sonst global) mit `?from=<id>`; den Text
// lädt die Seite auf dem Server. Passt der Prompt samt Zeile für die Änderung nicht in eine Nachricht, fehlt der Weg.
// "Für Entwickler exportieren" klappt das Export-Feld darunter auf.
const ACTION =
  "touch-hit-y relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50";

export function PromptReuseBar({
  promptId,
  title,
  content,
  projectId,
  fill,
}: {
  promptId: string;
  title: string;
  content: string;
  projectId?: string | null;
  /** Was im Formular der Platzhalter eingetragen ist, für den Export. */
  fill?: PlaceholderFill;
}) {
  const t = useT();
  const panelId = useId();
  const [exportOpen, setExportOpen] = useState(false);
  const fits = startFromText(t.prompts.startFromPrefix, content) !== null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
        {fits && (
          <HoverPrefetchLink
            href={startFromHref(promptId, projectId)}
            aria-label={fmt(t.prompts.startFromLabel, { title })}
            className={ACTION}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            {t.prompts.startFrom}
          </HoverPrefetchLink>
        )}
        <button
          type="button"
          onClick={() => setExportOpen((open) => !open)}
          aria-expanded={exportOpen}
          aria-controls={panelId}
          className={ACTION}
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden />
          {t.prompts.export.open}
        </button>
      </div>
      {exportOpen && <PromptExportPanel id={panelId} prompt={content} title={title} fill={fill} />}
    </>
  );
}

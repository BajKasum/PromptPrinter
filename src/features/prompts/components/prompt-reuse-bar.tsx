"use client";

import { MessageSquarePlus } from "lucide-react";
import { HoverPrefetchLink } from "@/shared/ui/hover-prefetch-link";
import { startFromHref, startFromText } from "@/shared/lib/start-from-prompt";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";

// Weiterverwenden eines gespeicherten Prompts, als eigene Leiste unter Kopieren, Umbenennen, PDF und Löschen.
// "Als Ausgangspunkt nutzen" öffnet einen neuen Chat (im Projekt des Prompts, sonst global) mit `?from=<id>`; den Text
// lädt die Seite auf dem Server. Passt der Prompt samt Zeile für die Änderung nicht in eine Nachricht, fehlt der Weg.
export function PromptReuseBar({
  promptId,
  title,
  content,
  projectId,
}: {
  promptId: string;
  title: string;
  content: string;
  projectId?: string | null;
}) {
  const t = useT();
  const fits = startFromText(t.prompts.startFromPrefix, content) !== null;
  if (!fits) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
      <HoverPrefetchLink
        href={startFromHref(promptId, projectId)}
        aria-label={fmt(t.prompts.startFromLabel, { title })}
        className="touch-hit-y relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
        {t.prompts.startFrom}
      </HoverPrefetchLink>
    </div>
  );
}

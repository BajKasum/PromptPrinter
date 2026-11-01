"use client";

import { useMemo } from "react";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";
import { assessPrompt, QUALITY_LINE_LIVE } from "@/features/chat/lib/prompt-quality";

// Die ruhige Zeile unter dem Prompt: was er nennt und was fehlt, ohne Punkte und ohne Ampel (#243). Sie
// steht nur im Produkt, wenn QUALITY_LINE_LIVE an ist; ohne Treffer der Erkennung bleibt sie leer.
export function PromptQualityLine({ prompt }: { prompt: string }) {
  const t = useT();
  const report = useMemo(() => (QUALITY_LINE_LIVE ? assessPrompt(prompt) : null), [prompt]);
  if (!report) return null;

  const names = (wanted: boolean) =>
    report.items
      .filter((i) => i.present === wanted)
      .map((i) => t.chat.quality[i.criterion])
      .join(", ");
  const have = names(true);
  const lack = names(false);

  return (
    <p
      role="note"
      aria-label={t.chat.quality.label}
      className="px-3 pb-3 text-[12.5px] leading-relaxed text-secondary md:px-7"
    >
      {have && <span>{fmt(t.chat.quality.present, { items: have })} </span>}
      {lack && <span className="text-foreground/85">{fmt(t.chat.quality.missing, { items: lack })} </span>}
      <span>{t.chat.quality.hint}</span>
    </p>
  );
}

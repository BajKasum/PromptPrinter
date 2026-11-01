"use client";

import { TriangleAlert } from "lucide-react";
import { fmt, plural } from "@/shared/i18n/format";
import { useLocale, useT } from "@/shared/i18n/provider";
import type { PromptRisk } from "@/features/chat/lib/prompt-check";

// Der Hinweis der Prompt-Prüfung (#236, #242): ein kleiner Knopf neben "Prompt kopieren" und darunter,
// ruhig und ohne Sperre, was aufgefallen ist. Kopieren bleibt immer möglich.

export function PromptCheckChip({
  count,
  open,
  controlsId,
  onToggle,
}: {
  count: number;
  open: boolean;
  controlsId: string;
  onToggle: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
      aria-label={`${plural(t.chat.promptCheck.chip, count, locale)}. ${t.chat.promptCheck.chipLabel}`}
      className="touch-hit-y relative inline-flex items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-warning transition-colors hover:bg-warning/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      {plural(t.chat.promptCheck.chip, count, locale)}
    </button>
  );
}

export function PromptCheckList({ id, risks }: { id: string; risks: PromptRisk[] }) {
  const t = useT();
  return (
    <div id={id} className="border-b border-border bg-warning/10 px-3 py-2.5 text-[12.5px] leading-relaxed md:px-3.5">
      <p className="font-medium text-foreground">{t.chat.promptCheck.intro}</p>
      <ul className="mt-1.5 space-y-1">
        {risks.map((risk) => (
          <li key={risk.kind} className="text-foreground/85">
            <span className="font-medium">{t.chat.promptCheck[risk.kind]}</span>
            {": "}
            <span className="font-mono text-[12px]">{risk.samples.join(", ")}</span>
            {risk.total > risk.samples.length && (
              <span className="text-secondary">
                {" "}
                {fmt(t.chat.promptCheck.more, { count: risk.total - risk.samples.length })}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-secondary">{t.chat.promptCheck.footer}</p>
    </div>
  );
}

"use client";

import { TriangleAlert } from "lucide-react";
import type { PromptRisk } from "@/shared/lib/prompt-check";
import { riskSummary } from "@/shared/lib/prompt-share-status";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n/provider";

/**
 * Die Rückfrage vor einem neuen Text, der unter einem Link öffentlich sein kann: was die Prüfung an Schlüsseln und
 * persönlichen Angaben gefunden hat. Steht an der Karte beim Bearbeiten und Wiederherstellen; der Knopf daneben heisst
 * dann "trotzdem".
 */
export function PublicRiskAlert({ risks, className }: { risks: PromptRisk[]; className?: string }) {
  const t = useT();
  if (risks.length === 0) return null;
  return (
    <p role="alert" className={cn("flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-[12.5px] text-foreground", className)}>
      <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      <span>
        {t.share.riskIntro} {riskSummary(risks, t.chat.promptCheck)}
      </span>
    </p>
  );
}

"use client";

import { Scissors } from "lucide-react";
import { useT } from "@/shared/i18n/provider";
import { cn } from "@/shared/lib/utils";

/**
 * Der Hinweis an einer Antwort, die nicht zu Ende ist (`done.truncated`). `advice`: an der neuesten Antwort, dort sagt
 * er auch, was hilft. Ältere lassen sich nicht neu erzeugen.
 */
export function TruncatedNote({ advice = false, className }: { advice?: boolean; className?: string }) {
  const t = useT();
  return (
    <p
      data-testid="truncated-note"
      className={cn("flex items-start gap-2 border-warning/30 bg-warning/10 text-[12.5px] text-warning", className)}
    >
      <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>
        {t.chat.truncated}
        {advice && ` ${t.chat.truncatedAdvice}`}
      </span>
    </p>
  );
}

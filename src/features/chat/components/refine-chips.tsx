"use client";

import { TapChip } from "@/features/chat/components/tap-chips";
import { useT } from "@/shared/i18n/provider";

// "Verfeinern per Tipp" unter dem neuesten fertigen Prompt (#245). Jeder Tipp ist ein ganz normaler Chat-Zug
// mit vorformulierter Nachricht in der Sprache der Oberfläche: er steht im Verlauf, zählt wie eine getippte
// Nachricht, und Finn antwortet mit dem vollständigen neuen Prompt (Systemprompt). "Anderes" schickt nichts,
// es setzt nur den Cursor ins Eingabefeld.
export function RefineChips({
  onRefine,
  onOther,
}: {
  onRefine: (message: string) => void;
  onOther: () => void;
}) {
  const t = useT();
  const r = t.chat.refine;
  return (
    <div role="group" aria-label={r.label} className="border-t border-border px-3 py-3 md:px-6">
      <div className="flex flex-wrap gap-2">
        <TapChip onClick={() => onRefine(r.shorterMsg)}>{r.shorter}</TapChip>
        <TapChip onClick={() => onRefine(r.longerMsg)}>{r.longer}</TapChip>
        <TapChip onClick={() => onRefine(r.formalMsg)}>{r.formal}</TapChip>
        <TapChip onClick={() => onRefine(r.casualMsg)}>{r.casual}</TapChip>
        <TapChip onClick={() => onRefine(r.englishMsg)}>{r.english}</TapChip>
        <TapChip onClick={onOther}>{r.other}</TapChip>
      </div>
    </div>
  );
}

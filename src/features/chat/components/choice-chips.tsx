"use client";

import { TapChip } from "@/features/chat/components/tap-chips";
import type { ChoiceQuestion } from "@/features/chat/lib/choices";
import { useT } from "@/shared/i18n/provider";

// Antwortvorschläge unter Finns Rückfrage (#225). Ein Tipp schreibt die Option ins Eingabefeld, abgeschickt
// wird erst mit "Senden". Texte erscheinen als reiner Text.
export function ChoiceChips({
  questions,
  onPick,
}: {
  questions: ChoiceQuestion[];
  onPick: (option: string) => void;
}) {
  const t = useT();
  return (
    <div role="group" aria-label={t.chat.choices.label} className="border-t border-border px-3 py-3 md:px-7">
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.question} role="group" aria-label={q.question}>
            <p className="text-[12.5px] text-secondary">{q.question}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {q.options.map((option) => (
                <TapChip key={option} onClick={() => onPick(option)}>
                  {option}
                </TapChip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

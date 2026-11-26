"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { risksBeforeWriting, type ShareStatus } from "@/shared/lib/prompt-share-status";
import { useT } from "@/shared/i18n/provider";
import { PublicRiskAlert } from "@/features/prompts/components/public-risk-alert";

/** So lang darf ein Titel werden, im Feld und beim Speichern. */
const TITLE_MAX = 80;

/**
 * Das Feld zum Umbenennen eines gespeicherten Prompts an der Karte. Die Seite unter dem Link (/geteilt/<token>) zeigt
 * den Titel als Überschrift: kann der Prompt geteilt sein (geteilt, Stand unbekannt oder noch unterwegs), fragt ein
 * neuer Titel mit Schlüssel oder persönlichen Angaben vorher nach, wie beim Bearbeiten. Enter und der Haken fragen nur,
 * erst der Knopf "Trotzdem umbenennen" übernimmt einen solchen Titel; wer weitertippt, wird wieder gefragt. Ein sicher
 * privater Prompt bekommt jeden Titel ohne Rückfrage. Geschrieben wird in der Karte (`onRename`), das Feld schliesst
 * dabei sofort.
 */
export function PromptRenameField({
  current,
  value,
  share,
  onChange,
  onRename,
  onCancel,
}: {
  /** Der Titel, den der Prompt jetzt hat: derselbe noch einmal ist kein Umbenennen. */
  current: string;
  value: string;
  /** Der Stand der Freigabe aus der Karte (features/prompts/hooks/use-share-status.ts). */
  share: ShareStatus;
  onChange: (value: string) => void;
  /** Bekommt den gekürzten Titel, erst wenn er geprüft oder die Rückfrage bestätigt ist. */
  onRename: (title: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  const next = value.trim().slice(0, TITLE_MAX);
  // Steht die Rückfrage, gilt "trotzdem" nur für das, was sie zeigt: wird der Prompt inzwischen als privat gemeldet,
  // verschwindet sie, und der Haken benennt wieder ohne Rückfrage um.
  const risks = confirming ? risksBeforeWriting(share, next) : [];

  function submit(confirmed: boolean) {
    if (!next || next === current) {
      onCancel();
      return;
    }
    if (!confirmed && risksBeforeWriting(share, next).length > 0) {
      setConfirming(true);
      return;
    }
    onRename(next);
  }

  const iconButton =
    "touch-hit-y relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          maxLength={TITLE_MAX}
          aria-label={t.prompts.newNameLabel}
          onChange={(e) => {
            onChange(e.target.value);
            setConfirming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(false);
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[13.5px] text-foreground transition-colors focus:border-ring focus:outline-hidden focus:ring-2 focus:ring-ring/20"
        />
        {/* Kein Ladezustand: Umbenennen schliesst das Feld beim Klick und setzt den Titel sofort, es bleibt kein
            Zeitfenster, das ein Knopf abwarten müsste. Während die Rückfrage steht, übernimmt nur ihr Knopf. */}
        {risks.length === 0 && (
          <button type="button" onClick={() => submit(false)} aria-label={t.prompts.saveName} className={iconButton}>
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onCancel} aria-label={t.prompts.cancelRename} className={iconButton}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {risks.length > 0 && (
        <div className="mt-2 space-y-2">
          <PublicRiskAlert risks={risks} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => submit(true)}
              className="touch-hit-y relative rounded-md bg-accent-subtle px-2.5 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent/15"
            >
              {t.prompts.renameAnyway}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { MAX_ASSISTANT_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import { risksBeforeWriting, type ShareStatus } from "@/shared/lib/prompt-share-status";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";
import { PublicRiskAlert } from "@/features/prompts/components/public-risk-alert";

/**
 * Den Text eines gespeicherten Prompts an der Karte ändern. Gespeichert wird nur der Text in
 * `outputs`, der Titel bleibt; die Datenbank legt daraus die nächste Version an (Migration 0061). Die Grenze im Feld
 * ist die einer Antwort im Chat, so viel kann Speichern aus dem Chat ohnehin übernehmen. Ist der Prompt geteilt, sagt
 * ein Hinweis, dass die Änderung sofort unter dem Link steht. Kann er geteilt sein (geteilt, Stand unbekannt oder noch
 * unterwegs), fragt die Prüfung auf Schlüssel und persönliche Angaben vor dem Speichern nach.
 */
export function PromptTextEditor({
  promptId,
  userId,
  title,
  content,
  share,
  onSaved,
  onClose,
}: {
  promptId: string;
  userId: string;
  title: string;
  content: string;
  /** Der Stand der Freigabe aus der Karte (features/prompts/hooks/use-share-status.ts). */
  share: ShareStatus;
  /**
   * Setzt den neuen Text in der Liste, erst wenn er geschrieben ist: der Verlauf lädt bei einem neuen Text nach und
   * sähe sonst noch die alte Zahl der Versionen.
   */
  onSaved: (content: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const fieldId = useId();
  const [text, setText] = useState(content);
  const [confirmingRisks, setConfirmingRisks] = useState(false);
  const [saving, setSaving] = useState(false);

  const next = text.trim() ? text : "";
  const unchanged = next === content;
  // Steht die Rückfrage, gilt "trotzdem" nur für das, was sie zeigt: wird der Prompt inzwischen als privat gemeldet,
  // verschwindet sie, und Speichern ist wieder ein gewöhnliches Speichern.
  const risks = confirmingRisks ? risksBeforeWriting(share, next) : [];

  async function save(confirmed: boolean) {
    if (!next || unchanged || saving) return;
    if (!confirmed && risksBeforeWriting(share, next).length > 0) {
      setConfirmingRisks(true);
      return;
    }
    setSaving(true);
    const { data, error } = await createClient()
      .from("saved_prompts")
      .update({ outputs: { prompt: next, title } })
      .eq("id", promptId)
      .eq("user_id", userId)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      toast({ title: t.prompts.edit.failed, description: t.prompts.tryAgain, variant: "error" });
      return;
    }
    onSaved(next);
    toast({ title: t.prompts.edit.saved, variant: "success" });
    onClose();
    router.refresh();
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <label htmlFor={fieldId} className="mb-1.5 block text-[12.5px] font-medium text-foreground/80">
        {fmt(t.prompts.edit.field, { title })}
      </label>
      <textarea
        id={fieldId}
        autoFocus
        value={text}
        maxLength={MAX_ASSISTANT_MESSAGE_CHARS}
        onChange={(e) => {
          setText(e.target.value);
          setConfirmingRisks(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        rows={12}
        className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground focus:border-ring focus:outline-hidden focus:ring-2 focus:ring-ring/20"
      />
      <p className="mt-1 text-right text-[12px] text-tertiary">
        {fmt(t.prompts.edit.count, { n: text.length, max: MAX_ASSISTANT_MESSAGE_CHARS })}
      </p>
      {share.status === "shared" && <p className="mt-1 text-[12.5px] text-secondary">{t.prompts.edit.sharedHint}</p>}
      <PublicRiskAlert risks={risks} className="mt-2" />
      <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
        {unchanged && <span className="mr-auto text-[12px] text-tertiary">{t.prompts.edit.unchanged}</span>}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2.5 py-1 text-[12.5px] text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={() => void save(risks.length > 0)}
          disabled={!next || unchanged || saving}
          className="rounded-md bg-accent-subtle px-2.5 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent/15 disabled:opacity-60"
        >
          {risks.length > 0 ? t.prompts.edit.saveAnyway : t.prompts.edit.save}
        </button>
      </div>
    </div>
  );
}

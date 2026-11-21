"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { MAX_ASSISTANT_MESSAGE_CHARS } from "@/shared/lib/chat-limits";
import { checkPrompt } from "@/shared/lib/prompt-check";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";

// Was vor dem Teilen geprüft wird, gilt auch, wenn ein geteilter Prompt einen neuen Text bekommt (share-prompt.tsx).
const PUBLIC_RISKS = new Set(["secret", "personal"]);

/**
 * Den Text eines gespeicherten Prompts an der Karte ändern. Gespeichert wird nur der Text in
 * `outputs`, der Titel bleibt; die Datenbank legt daraus die nächste Version an (Migration 0061). Die Grenze im Feld
 * ist die einer Antwort im Chat, so viel kann Speichern aus dem Chat ohnehin übernehmen. Ist der Prompt geteilt, sagt
 * ein Hinweis, dass die Änderung sofort unter dem Link steht, und die Prüfung auf Schlüssel und persönliche Angaben
 * fragt vor dem Speichern nach.
 */
export function PromptTextEditor({
  promptId,
  userId,
  title,
  content,
  onSaved,
  onClose,
}: {
  promptId: string;
  userId: string;
  title: string;
  content: string;
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
  const [shared, setShared] = useState(false);
  const [confirmingRisks, setConfirmingRisks] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void createClient()
      .from("prompt_shares")
      .select("prompt_id")
      .eq("prompt_id", promptId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setShared(Boolean(data));
      });
    return () => {
      live = false;
    };
  }, [promptId, userId]);

  const next = text.trim() ? text : "";
  const unchanged = next === content;
  const risks = shared && confirmingRisks ? checkPrompt(next).filter((r) => PUBLIC_RISKS.has(r.kind)) : [];

  async function save(confirmed = false) {
    if (!next || unchanged || saving) return;
    if (shared && !confirmed && checkPrompt(next).some((r) => PUBLIC_RISKS.has(r.kind))) {
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
      {shared && <p className="mt-1 text-[12.5px] text-secondary">{t.prompts.edit.sharedHint}</p>}
      {risks.length > 0 && (
        <p role="alert" className="mt-2 flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-[12.5px] text-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            {t.share.riskIntro}{" "}
            {risks.map((r) => `${t.chat.promptCheck[r.kind]} (${r.samples.join(", ")})`).join("; ")}
          </span>
        </p>
      )}
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
          onClick={() => void save(confirmingRisks)}
          disabled={!next || unchanged || saving}
          className="rounded-md bg-accent-subtle px-2.5 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent/15 disabled:opacity-60"
        >
          {confirmingRisks ? t.prompts.edit.saveAnyway : t.prompts.edit.save}
        </button>
      </div>
    </div>
  );
}

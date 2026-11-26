"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { derivePromptTitle } from "@/shared/lib/saved-prompts";
import { offersNewVersion, type VersionTarget } from "@/shared/lib/prompt-versions";
import { fetchShareStatus, mayBePublic, publicRisks, riskSummary, type ShareStatus } from "@/shared/lib/prompt-share-status";
import type { PromptRisk } from "@/shared/lib/prompt-check";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";

type SaveState = "idle" | "choosing" | "saving" | "saved";

// "Prompt speichern" im Ergebnis-Panel des Chats. Geschrieben wird mit dem Browser-Client unter RLS (die Policies von
// saved_prompts prüfen Konto, Projekt und Chat), ohne API-Route und ohne Modellaufruf.
//
// Neu oder neue Version: Gibt es einen Kandidaten (zuletzt aus diesem Chat gespeichert, sonst der Ursprung aus "Als
// Ausgangspunkt nutzen"; server/prompt-version-target.ts) mit anderem Text, klappt Speichern zwei Wege auf. "Neue
// Version" ändert nur den Text des Kandidaten, die Datenbank legt die Version an (Migration 0061); der Titel bleibt.
// "Neuer Prompt" legt eine Zeile an und vermerkt den Chat (`conversation_id`). Ohne Kandidaten bleibt es ein Klick.
//
// Ein schon gespeicherter Text (`initiallySaved`) startet und bleibt im Zustand "gespeichert", damit derselbe Prompt
// nicht doppelt in der Liste landet.
//
// Ist der Kandidat per Link geteilt, steht eine neue Version sofort unter dem Link. Findet die Prüfung im Text
// Schlüssel oder persönliche Angaben, liest Speichern deshalb erst den Stand der Freigabe (shared/lib/prompt-share-status.ts)
// und fragt bei einem geteilten oder nicht lesbaren Stand in einem Dialog nach, wie Bearbeiten an der Karte. Ein neuer
// Prompt ist noch nirgends geteilt und fragt nicht.
export function SavePromptButton({
  projectId,
  conversationId,
  versionTarget,
  prompt,
  initiallySaved = false,
}: {
  /** Fehlt (oder null) in einem Chat ohne Projekt. */
  projectId?: string | null;
  /** Der Chat, aus dem gespeichert wird; ein neuer Prompt vermerkt ihn. */
  conversationId?: string | null;
  /** Wovon Speichern eine neue Version anbietet. */
  versionTarget?: VersionTarget | null;
  prompt: string;
  initiallySaved?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<SaveState>(initiallySaved ? "saved" : "idle");
  // Die Rückfrage vor einer neuen Version: was gefunden wurde und welcher Stand der Freigabe galt. Der Inhalt bleibt
  // stehen, solange der Dialog ausblendet; offen ist er nur mit `asking`.
  const [riskCheck, setRiskCheck] = useState<{ risks: PromptRisk[]; share: ShareStatus } | null>(null);
  const [asking, setAsking] = useState(false);
  const choicesId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const target = offersNewVersion(versionTarget, prompt) ? versionTarget : null;
  const targetTitle = target ? target.title || derivePromptTitle(target.prompt, t.prompts.fallbackTitle) : "";

  // Aufgeklappt schliessen Escape und ein Klick daneben die Wahl, der Fokus geht an den Knopf zurück.
  useEffect(() => {
    if (state !== "choosing") return;
    const close = (refocus: boolean) => {
      setState("idle");
      if (refocus) toggleRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [state]);

  async function save(mode: "new" | "version", confirmed = false) {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    setAsking(false);

    if (mode === "version" && target && !confirmed) {
      const risks = publicRisks(prompt);
      if (risks.length > 0) {
        const share = await fetchShareStatus(target.id);
        if (mayBePublic(share)) {
          setState("idle");
          setRiskCheck({ risks, share });
          setAsking(true);
          return;
        }
      }
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("idle");
      toast({ title: t.chat.notSignedIn, description: t.chat.signInToSave, variant: "error" });
      return;
    }

    const written =
      mode === "version" && target
        ? await supabase
            .from("saved_prompts")
            .update({ outputs: { prompt, title: targetTitle } })
            .eq("id", target.id)
            .eq("user_id", user.id)
            .select("id")
        : await supabase
            .from("saved_prompts")
            .insert({
              project_id: projectId ?? null,
              conversation_id: conversationId ?? null,
              user_id: user.id,
              outputs: { prompt, title: derivePromptTitle(prompt, t.prompts.fallbackTitle) },
            })
            .select("id");

    // Ein Update ohne Zeile heisst: der Prompt ist inzwischen gelöscht. Dann nichts behaupten.
    if (written.error || !written.data?.length) {
      setState("idle");
      toast({ title: t.chat.saveFailed, description: t.chat.saveFailedBody, variant: "error" });
      return;
    }

    setState("saved");
    toast({
      title: mode === "version" ? fmt(t.chat.versionSaved, { title: targetTitle }) : t.chat.promptSaved,
      variant: "success",
    });
    // Zähler im Projekt und der Kandidat für das nächste Speichern kommen vom Server.
    router.refresh();
  }

  const label = state === "saving" ? t.chat.saving : state === "saved" ? t.common.saved : t.common.save;
  const icon =
    state === "saving" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : state === "saved" ? (
      <Check className="h-3.5 w-3.5 text-success" />
    ) : (
      <Bookmark className="h-3.5 w-3.5" />
    );
  const buttonClass =
    "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] text-foreground/70 transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-70";

  if (!target || state === "saved") {
    return (
      <button type="button" onClick={() => void save("new")} disabled={state !== "idle"} className={buttonClass}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={state === "choosing"}
        aria-controls={choicesId}
        onClick={() => setState(state === "choosing" ? "idle" : "choosing")}
        disabled={state === "saving"}
        className={buttonClass}
      >
        {icon}
        {label}
        <ChevronDown aria-hidden className="h-3 w-3" />
      </button>
      {state === "choosing" && (
        <div
          id={choicesId}
          role="group"
          aria-label={t.chat.saveChoices}
          className="absolute right-0 top-full z-20 mt-1.5 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg border border-border-strong bg-surface-raised p-1.5 shadow-elevated"
        >
          <button
            type="button"
            onClick={() => void save("version")}
            className="rounded-md px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover focus-visible:bg-surface-hover"
          >
            <span className="block font-medium">{t.chat.saveAsVersion}</span>
            <span className="block truncate text-[12px] text-secondary">{fmt(t.chat.saveAsVersionOf, { title: targetTitle })}</span>
          </button>
          <button
            type="button"
            onClick={() => void save("new")}
            className="rounded-md px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover focus-visible:bg-surface-hover"
          >
            <span className="block font-medium">{t.chat.saveAsNew}</span>
            <span className="block text-[12px] text-secondary">{t.chat.saveAsNewHint}</span>
          </button>
        </div>
      )}
      <ConfirmDialog
        open={asking}
        title={t.chat.versionRisk.title}
        description={
          <>
            <span className="block">
              {fmt(riskCheck?.share.status === "shared" ? t.chat.versionRisk.shared : t.chat.versionRisk.unknown, {
                title: targetTitle,
              })}
            </span>
            <span className="mt-3 flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-foreground">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <span>
                {t.share.riskIntro} {riskSummary(riskCheck?.risks ?? [], t.chat.promptCheck)}
              </span>
            </span>
          </>
        }
        confirmLabel={t.prompts.edit.saveAnyway}
        busyLabel={t.chat.saving}
        onConfirm={() => void save("version", true)}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { createClient } from "@/shared/supabase/client";
import { ABOUT_ME_MAX_LENGTH } from "@/shared/lib/about-me";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";
import { SettingsCard } from "@/features/settings/components/settings-card";

// "Über mich": ein freiwilliges Feld, das der Chat jedem Zug als gekennzeichneten Block mitgibt
// (shared/lib/about-me.ts, app/api/chat/turn.ts). Der Browser schreibt die Spalte profiles.about_me direkt; die
// Grenze von 1000 Zeichen steht deshalb auch in der Datenbank (Migration 0056). Eigener Speichern-Knopf statt der
// Leiste der übrigen Einstellungen: das Feld ist lang, und ein Tippfehler im Namen soll nicht mitgespeichert werden.

export function AboutMe({ userId, initialAboutMe }: { userId: string; initialAboutMe: string }) {
  const t = useT();
  const { toast } = useToast();
  const [value, setValue] = useState(initialAboutMe);
  const [saved, setSaved] = useState(initialAboutMe);
  const [saving, setSaving] = useState(false);

  const dirty = value.trim() !== saved.trim();

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    const next = value.trim().slice(0, ABOUT_ME_MAX_LENGTH);
    const { error } = await createClient().from("profiles").update({ about_me: next }).eq("id", userId);
    setSaving(false);
    if (error) {
      toast({ title: t.aboutMe.saveFailed, variant: "error" });
      return;
    }
    setValue(next);
    setSaved(next);
    toast({ title: t.aboutMe.saved, variant: "success" });
  }

  return (
    <SettingsCard id="ueber-mich" Icon={NotebookPen} accent="--accent" title={t.aboutMe.title} description={t.aboutMe.hint}>
      <label htmlFor="about-me" className="sr-only">
        {t.aboutMe.label}
      </label>
      <textarea
        id="about-me"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={ABOUT_ME_MAX_LENGTH}
        rows={5}
        placeholder={t.aboutMe.placeholder}
        aria-describedby="about-me-privacy about-me-count"
        className="w-full resize-y rounded-lg border border-border bg-surface px-3.5 py-3 text-[16px] leading-[1.6] text-foreground placeholder:text-tertiary focus-glow focus:outline-hidden md:text-sm"
      />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p id="about-me-privacy" className="text-[12px] text-tertiary">
          {t.aboutMe.privacy}
        </p>
        <p id="about-me-count" className="font-mono text-[12px] tabular-nums text-tertiary">
          {fmt(t.aboutMe.counter, { count: value.length, max: ABOUT_ME_MAX_LENGTH })}
        </p>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {saving ? t.aboutMe.saving : t.aboutMe.save}
        </Button>
      </div>
    </SettingsCard>
  );
}

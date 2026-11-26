"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, History } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { useToast } from "@/shared/ui/toast";
import { cn, relativeTime } from "@/shared/lib/utils";
import { diffWords, hasChanges } from "@/shared/lib/word-diff";
import { VERSIONS_PAGE, type PromptVersion } from "@/shared/lib/prompt-versions";
import { risksBeforeWriting, type ShareStatus } from "@/shared/lib/prompt-share-status";
import { useLocale, useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { PublicRiskAlert } from "@/features/prompts/components/public-risk-alert";

/**
 * Der Verlauf eines gespeicherten Prompts an der Karte: erscheint erst ab zwei Versionen, lädt die Versionen beim
 * Aufklappen (die neuesten zuerst, seitenweise), vergleicht zwei davon Wort für Wort und stellt eine alte wieder her.
 * Wiederherstellen schreibt den alten Text als aktuelle Fassung zurück, die Datenbank legt ihn als neueste Version an
 * (Migration 0061): nichts geht verloren. Gelesen wird mit RLS und zusätzlich `user_id`. Bei einem Prompt, der geteilt
 * sein kann, steht der alte Text sofort unter dem Link; deshalb fragt Wiederherstellen vor Schlüsseln und persönlichen
 * Angaben nach wie Bearbeiten.
 */
export function PromptHistory({
  promptId,
  userId,
  title,
  content,
  share,
  onRestored,
}: {
  promptId: string;
  userId: string;
  title: string;
  /** Die aktuelle Fassung; ändert sie sich (Bearbeiten, Wiederherstellen), lädt der Verlauf neu. */
  content: string;
  /** Der Stand der Freigabe aus der Karte (features/prompts/hooks/use-share-status.ts). */
  share: ShareStatus;
  /** Setzt den wiederhergestellten Text in der Liste, erst wenn er geschrieben ist (sonst lüde der Verlauf zu früh nach). */
  onRestored: (content: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const panelId = useId();
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [failed, setFailed] = useState(false);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  // Die Version, deren Wiederherstellen gerade nachfragt.
  const [confirming, setConfirming] = useState<number | null>(null);
  // Nur die zuletzt gestartete Abfrage zählt: ein Nachladen von vor dem Wiederherstellen kommt sonst später an und
  // zeigte den alten Stand.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const request = ++latestRequest.current;
      const { data, error, count: total } = await createClient()
        .from("saved_prompt_versions")
        .select("version, content, created_at", { count: "exact" })
        .eq("prompt_id", promptId)
        .eq("user_id", userId)
        .order("version", { ascending: false })
        .range(offset, offset + VERSIONS_PAGE - 1);
      if (request !== latestRequest.current) return null;
      if (error) {
        setFailed(true);
        return null;
      }
      setFailed(false);
      setCount(total ?? null);
      return (data ?? []).map((r) => ({ version: r.version, content: r.content, createdAt: r.created_at }));
    },
    [promptId, userId]
  );

  // Die Zahl beim Aufklappen der Karte und nach jeder neuen Fassung; die Versionen selbst erst, wenn der Verlauf offen ist.
  useEffect(() => {
    let live = true;
    void load(0).then((page) => {
      if (!live || !page) return;
      setVersions(page);
      setTo(page[0]?.version ?? null);
      setFrom(page[1]?.version ?? null);
    });
    return () => {
      live = false;
    };
  }, [load, content]);

  const byNumber = useMemo(() => new Map(versions.map((v) => [v.version, v])), [versions]);
  const latest = versions[0]?.version ?? null;
  const older = from !== null ? byNumber.get(from) : undefined;
  const newer = to !== null ? byNumber.get(to) : undefined;
  const parts = useMemo(() => (older && newer ? diffWords(older.content, newer.content) : []), [older, newer]);
  // Wie beim Bearbeiten gilt "trotzdem" nur für das, was die Rückfrage zeigt.
  const risks = older && confirming === older.version ? risksBeforeWriting(share, older.content) : [];

  if (!count || count < 2) return null;

  const label = (v: PromptVersion) =>
    `${fmt(t.prompts.history.version, { n: v.version })} · ${relativeTime(v.createdAt, LOCALE_TAGS[locale].intl, t.time.justNow)}` +
    (v.version === latest ? ` (${t.prompts.history.current})` : "");

  async function loadMore() {
    const page = await load(versions.length);
    if (page) setVersions((list) => [...list, ...page.filter((v) => !list.some((o) => o.version === v.version))]);
  }

  async function restore(version: PromptVersion, confirmed: boolean) {
    if (restoring) return;
    if (!confirmed && risksBeforeWriting(share, version.content).length > 0) {
      setConfirming(version.version);
      return;
    }
    setConfirming(null);
    setRestoring(true);
    const { data, error } = await createClient()
      .from("saved_prompts")
      .update({ outputs: { prompt: version.content, title } })
      .eq("id", promptId)
      .eq("user_id", userId)
      .select("id");
    if (error || !data?.length) {
      setRestoring(false);
      toast({ title: t.prompts.history.restoreFailed, description: t.prompts.tryAgain, variant: "error" });
      return;
    }
    // Die neue Nummer für die Meldung; den Verlauf selbst lädt der neue Text nach (Effekt oben).
    const page = await load(0);
    setRestoring(false);
    onRestored(version.content);
    toast({
      title: fmt(t.prompts.history.restored, { old: version.version, new: page?.[0]?.version ?? "" }),
      variant: "success",
    });
    router.refresh();
  }

  return (
    <div className="border-t border-border">
      <h4>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px] text-secondary transition-colors hover:text-foreground"
        >
          <ChevronRight aria-hidden className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
          <History aria-hidden className="h-3.5 w-3.5" />
          {fmt(t.prompts.history.open, { count })}
        </button>
      </h4>
      {open && (
        <div id={panelId} className="space-y-2.5 px-4 pb-3">
          {failed && <p role="alert" className="text-[12.5px] text-destructive">{t.prompts.history.loadFailed}</p>}
          <div className="flex flex-wrap items-end gap-2">
            <VersionSelect label={t.prompts.history.from} value={from} versions={versions} format={label} onChange={setFrom} />
            <VersionSelect label={t.prompts.history.to} value={to} versions={versions} format={label} onChange={setTo} />
            {versions.length < count && (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="rounded-md px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                {t.prompts.history.more}
              </button>
            )}
          </div>
          {older && newer && (
            <div
              role="group"
              aria-label={fmt(t.prompts.history.compareLabel, { from: older.version, to: newer.version })}
              className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground/85"
            >
              {!hasChanges(parts)
                ? t.prompts.history.noChanges
                : parts.map((p, i) =>
                    p.kind === "same" ? (
                      <span key={i}>{p.text}</span>
                    ) : p.kind === "removed" ? (
                      <del key={i} className="bg-destructive/10 text-foreground line-through decoration-destructive">
                        <span className="sr-only">{t.prompts.history.removed} </span>
                        {p.text}
                      </del>
                    ) : (
                      <ins key={i} className="bg-success/10 text-foreground underline decoration-success">
                        <span className="sr-only">{t.prompts.history.added} </span>
                        {p.text}
                      </ins>
                    )
                  )}
            </div>
          )}
          {/* Eine Fassung mit demselben Text wie die aktuelle legte die Datenbank nicht neu an: nichts anzubieten. */}
          {older && older.version !== latest && older.content !== content && (
            <div className="space-y-2">
              {share.status === "shared" && <p className="text-[12.5px] text-secondary">{t.prompts.history.sharedHint}</p>}
              <PublicRiskAlert risks={risks} />
              <button
                type="button"
                onClick={() => void restore(older, risks.length > 0)}
                disabled={restoring}
                className="rounded-md bg-accent-subtle px-2.5 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent/15 disabled:opacity-60"
              >
                {fmt(risks.length > 0 ? t.prompts.history.restoreAnyway : t.prompts.history.restore, { n: older.version })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VersionSelect({
  label,
  value,
  versions,
  format,
  onChange,
}: {
  label: string;
  value: number | null;
  versions: PromptVersion[];
  format: (v: PromptVersion) => string;
  onChange: (version: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[12px] text-tertiary">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 max-w-[260px] rounded-md border border-border bg-background px-2 text-[12.5px] text-foreground focus:border-ring focus:outline-hidden focus:ring-2 focus:ring-ring/20"
      >
        {versions.map((v) => (
          <option key={v.version} value={v.version}>
            {format(v)}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { Check, Copy, PenLine } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { fillPlaceholders, findPlaceholders } from "@/features/chat/lib/placeholders";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";
import { fmt } from "@/shared/i18n/format";
import { useT } from "@/shared/i18n/provider";

// Platzhalter im fertigen Prompt direkt ausfüllen (#224). Alles bleibt im Browser: kein Aufruf, kein
// Speichern, kein <form>, das ein Browser zum Merken anbieten könnte. Gespeichert wird weiter der
// Prompt mit seinen Platzhaltern.
export function PlaceholderForm({ prompt }: { prompt: string }) {
  const t = useT();
  const baseId = useId();
  const placeholders = useMemo(() => findPlaceholders(prompt), [prompt]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const { copied, copy } = useCopyToClipboard();
  const filled = useMemo(() => fillPlaceholders(prompt, values, skipped), [prompt, values, skipped]);

  if (placeholders.length === 0) return null;

  const anythingTyped = placeholders.some((p) => !skipped.has(p.key) && (values[p.key] ?? "").trim() !== "");
  const toggleSkip = (key: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="border-t border-border px-3 py-2 md:px-7">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${baseId}-panel`}
        className="inline-flex h-11 items-center gap-2 rounded-md px-1 text-[13px] font-medium text-accent-text transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <PenLine className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        {fmt(t.chat.fill.open, { count: placeholders.length })}
      </button>

      {open && (
        <div id={`${baseId}-panel`} role="group" aria-label={t.chat.fill.title} className="pb-3 pt-1">
          <p className="text-[12px] leading-relaxed text-secondary">{t.chat.fill.hint}</p>
          <div className="mt-3 space-y-3">
            {placeholders.map((p, i) => {
              const inputId = `${baseId}-${i}`;
              const off = skipped.has(p.key);
              return (
                <div key={p.key}>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={inputId} className="text-[13px] font-medium text-foreground/85">
                      {p.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleSkip(p.key)}
                      aria-pressed={off}
                      aria-label={fmt(t.chat.fill.skipLabel, { name: p.label })}
                      className="touch-hit-y relative rounded-md px-1.5 text-[12px] text-secondary underline-offset-2 transition-colors hover:text-foreground aria-pressed:text-foreground aria-pressed:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {t.chat.fill.skip}
                    </button>
                  </div>
                  <Input
                    id={inputId}
                    value={values[p.key] ?? ""}
                    disabled={off}
                    autoComplete="off"
                    onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              );
            })}
          </div>

          {anythingTyped && (
            <div className="mt-4">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-tertiary">{t.chat.fill.preview}</p>
              <pre className="mt-1.5 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
                {filled}
              </pre>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="accent" onClick={() => void copy(filled)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t.common.copied : t.chat.fill.copy}
            </Button>
            <span className="text-[12px] text-secondary">{t.chat.fill.leftEmpty}</span>
          </div>
        </div>
      )}
    </div>
  );
}

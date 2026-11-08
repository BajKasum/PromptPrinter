"use client";

import { useId, useState } from "react";
import { ChevronDown, ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { MarkdownMessage } from "@/features/chat/components/chat-markdown";
import { openTargetFor, type OpenTarget } from "@/features/chat/lib/open-in";
import { readHttpFailure } from "@/features/chat/lib/turn-outcome";
import { useT } from "@/shared/i18n/provider";
import { cn } from "@/shared/lib/utils";

// Was man mit dem fertigen Prompt gleich tun kann: ihn in ChatGPT oder Claude öffnen, oder einmal ausprobieren
// (Probelauf, api/test-run). Beides nimmt die Fassung mit ausgefüllten Platzhaltern, wenn es eine gibt.
export function PromptActions({ prompt }: { prompt: string }) {
  const t = useT();
  const [note, setNote] = useState<string | null>(null);
  const [run, setRun] = useState<
    { state: "idle" } | { state: "running" } | { state: "done"; reply: string } | { state: "failed"; message: string }
  >({ state: "idle" });
  const [open, setOpen] = useState(true);
  const regionId = useId();

  async function openIn(target: OpenTarget) {
    const plan = openTargetFor(target);
    // Der Prompt geht über die Zwischenablage (open-in.ts). Das Kopieren startet vor dem neuen Tab, solange diese Seite den Fokus hat; das Öffnen bleibt im Klick selbst,
    // sonst hielte es ein Popup-Blocker auf.
    const copied = navigator.clipboard?.writeText(prompt).then(
      () => true,
      () => false
    ) ?? Promise.resolve(false);
    window.open(plan.url, "_blank", "noopener,noreferrer");
    const ok = await copied;
    setNote(ok ? t.chat.openIn.copied : t.chat.openIn.opened);
  }

  async function testRun() {
    setRun({ state: "running" });
    setOpen(true);
    try {
      const res = await fetch("/api/test-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw await readHttpFailure(res, t.chat.testRun.failed);
      const json = (await res.json()) as { reply?: string };
      setRun({ state: "done", reply: json.reply ?? "" });
    } catch (err) {
      setRun({ state: "failed", message: err instanceof Error ? err.message : t.chat.testRun.failed });
    }
  }

  const button =
    "touch-hit-y relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-secondary transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60";

  return (
    <div className="border-t border-border px-3 py-2 md:px-7">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <button type="button" className={button} onClick={() => void openIn("chatgpt")}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          {t.chat.openIn.chatgpt}
        </button>
        <button type="button" className={button} onClick={() => void openIn("claude")}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          {t.chat.openIn.claude}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => void testRun()}
          disabled={run.state === "running"}
          aria-describedby={`${regionId}-hint`}
        >
          {run.state === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <FlaskConical className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          )}
          {run.state === "running" ? t.chat.testRun.running : t.chat.testRun.button}
        </button>
        <span id={`${regionId}-hint`} className="sr-only">
          {t.chat.testRun.hint}
        </span>
      </div>

      <p role="status" aria-live="polite" className={cn("px-2 text-[12px] text-secondary", !note && "sr-only")}>
        {note ?? ""}
      </p>

      {run.state === "failed" && (
        <p role="alert" className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {run.message}
        </p>
      )}

      {run.state === "done" && (
        <section aria-labelledby={`${regionId}-title`} className="mt-2 rounded-lg border border-dashed border-border-strong">
          <h3 id={`${regionId}-title`} className="m-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${regionId}-body`}
              onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] font-medium text-foreground/85"
            >
              {t.chat.testRun.title}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
            </button>
          </h3>
          {open && (
            <div id={`${regionId}-body`} className="border-t border-border px-3 py-3 text-[13.5px] leading-[1.65] text-foreground/85">
              <p className="mb-2 text-[12px] text-tertiary">{t.chat.testRun.disclaimer}</p>
              <MarkdownMessage content={run.reply} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

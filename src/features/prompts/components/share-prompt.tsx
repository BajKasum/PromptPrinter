"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, TriangleAlert } from "lucide-react";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useToast } from "@/shared/ui/toast";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard";
import { checkPrompt } from "@/shared/lib/prompt-check";
import { useT } from "@/shared/i18n/provider";

// Teilen eines gespeicherten Prompts per Link (/geteilt/<token>, server/prompt-share.ts). Vor dem ersten Teilen
// fragt ein Dialog nach: der Text wird öffentlich, jeder mit dem Link kann ihn lesen. Findet die Prompt-Prüfung
// Schlüssel oder persönliche Angaben, steht das im selben Dialog. Ist er geteilt, zeigt die Leiste den Link zum
// Kopieren und den Knopf zum Widerrufen. Die Leiste steht nur im aufgeklappten Prompt und fragt erst dann ab, ob er
// geteilt ist.

type State = { status: "idle" } | { status: "loading" } | { status: "shared"; token: string } | { status: "private" };

const PUBLIC_RISKS = new Set(["secret", "personal"]);

export function SharePrompt({ promptId, content }: { promptId: string; content: string }) {
  const t = useT();
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();
  const [state, setState] = useState<State>({ status: "idle" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const endpoint = `/api/prompts/${promptId}/share`;

  async function call(method: "POST" | "DELETE"): Promise<string | null | undefined> {
    const res = await fetch(endpoint, { method });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { token: string | null };
    return body.token;
  }

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    fetch(endpoint)
      .then((res) => (res.ok ? (res.json() as Promise<{ token: string | null }>) : { token: null }))
      .catch(() => ({ token: null }))
      .then(({ token }) => {
        if (live) setState(token ? { status: "shared", token } : { status: "private" });
      });
    return () => {
      live = false;
    };
  }, [endpoint]);

  async function share() {
    setBusy(true);
    const token = await call("POST").catch(() => undefined);
    setBusy(false);
    setConfirming(false);
    if (!token) {
      toast({ title: t.share.failed, variant: "error" });
      return;
    }
    setState({ status: "shared", token });
    copy(linkFor(token));
    toast({ title: t.share.shared, variant: "success" });
  }

  async function revoke() {
    setBusy(true);
    const result = await call("DELETE").catch(() => undefined);
    setBusy(false);
    if (result === undefined) {
      toast({ title: t.share.failed, variant: "error" });
      return;
    }
    setState({ status: "private" });
    toast({ title: t.share.revoked, variant: "success" });
  }

  const risks = confirming ? checkPrompt(content).filter((r) => PUBLIC_RISKS.has(r.kind)) : [];

  return (
    <div>
      {state.status === "shared" ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-accent-text" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-secondary">{linkFor(state.token)}</span>
          <button
            type="button"
            onClick={() => copy(linkFor(state.token))}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent-subtle"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t.common.copied : t.share.copyLink}
          </button>
          <button
            type="button"
            onClick={() => void revoke()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-tertiary transition-colors hover:bg-surface-hover hover:text-destructive disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t.share.revoke}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="px-1 text-[12px] text-tertiary">{t.share.privateHint}</span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={state.status === "loading"}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-accent-subtle disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {t.share.action}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        tone="neutral"
        title={t.share.confirmTitle}
        description={
          <>
            <span className="block">{t.share.confirmBody}</span>
            {risks.length > 0 && (
              <span className="mt-3 flex gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[13px] text-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span>
                  {t.share.riskIntro}{" "}
                  {risks.map((r) => `${t.chat.promptCheck[r.kind]} (${r.samples.join(", ")})`).join("; ")}
                </span>
              </span>
            )}
          </>
        }
        confirmLabel={t.share.confirm}
        busyLabel={t.share.sharing}
        busy={busy}
        onConfirm={() => void share()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function linkFor(token: string): string {
  return `${window.location.origin}/geteilt/${token}`;
}

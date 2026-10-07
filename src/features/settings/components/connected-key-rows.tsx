"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plug, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { ToolLogo } from "@/shared/brand/tool-logos";
import type { CustomProviderMeta } from "@/shared/lib/byok-types";
import { NAMED_PROVIDER_META, type NamedByokProvider } from "@/shared/lib/byok-detect";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

// Die Zeilen der schon verbundenen Anbieter aus api-keys.tsx (Dateigröße, Betriebs-Audit
// Folgesitzung 2026-10-07): unverändert verschoben, nur exportiert.

/** One row per already-connected named provider (Anthropic/OpenAI/Gemini). */
export function ConnectedProviderRow({
  provider,
  isActive,
  canActivate,
}: {
  provider: NamedByokProvider;
  isActive: boolean;
  canActivate: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const meta = NAMED_PROVIDER_META[provider];

  // Switching which stored key is billed (Security-Audit finding M-6). The
  // server does the swap in one statement (set_active_byok_provider), so
  // there is never a moment with two active keys or none.
  async function activate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.detail ?? t.settings.keys.activateFailed);
      }
      toast({ title: fmt(t.settings.keys.activated, { name: meta.name }), variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.keys.activateFailedTitle,
        description: err instanceof Error ? err.message : t.common.unknownError,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/api-key?provider=${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.detail ?? t.settings.keys.removeFailed);
      }
      toast({ title: fmt(t.settings.keys.removed, { name: meta.name }), variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.keys.removeFailedTitle,
        description: err instanceof Error ? err.message : t.common.unknownError,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/[0.06] px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
        <ToolLogo name={meta.logo} size={16} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium text-foreground">{meta.name}</div>
        <div className="truncate text-[11px] text-tertiary">{meta.sub}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Security-Audit finding M-6: every connected provider used to read
            "Verbunden" while exactly one of them was actually in use. Which
            one is the thing worth saying. */}
        {isActive ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
            <Check className="h-3 w-3" />
            {t.settings.keys.active}
          </span>
        ) : canActivate ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-[11px]"
            onClick={() => void activate()}
            disabled={busy}
          >
            {t.settings.keys.activate}
          </Button>
        ) : (
          <span className="text-[11px] font-medium text-tertiary">
            {t.settings.keys.connectedState}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-tertiary hover:text-destructive"
          onClick={() => void remove()}
          disabled={busy}
          aria-label={fmt(t.settings.keys.removeLabel, { name: meta.name })}
          data-testid={`remove-${provider}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/** The connected state of the generic "custom" endpoint slot. */
export function ConnectedCustomRow({ meta }: { meta: CustomProviderMeta }) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key?provider=custom", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.detail ?? t.settings.keys.removeFailed);
      }
      toast({ title: t.settings.keys.removedPlain, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.keys.removeFailedTitle,
        description: err instanceof Error ? err.message : t.common.unknownError,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/[0.06] px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
        <Plug className="h-4 w-4 text-tertiary" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium text-foreground">{meta.label}</div>
        <div className="truncate text-[11px] text-tertiary">{meta.model}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-success">
          <Check className="h-3 w-3" />
          {t.settings.keys.connectedState}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-tertiary hover:text-destructive"
          onClick={() => void remove()}
          disabled={busy}
          aria-label={t.settings.keys.removeCustomLabel}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

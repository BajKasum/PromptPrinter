"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plug, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useToast } from "@/shared/ui/toast";
import { ToolLogo } from "@/shared/brand/tool-logos";
import type { CustomProviderMeta } from "@/shared/lib/byok-types";
import { NAMED_PROVIDER_META, type NamedByokProvider } from "@/shared/lib/byok-detect";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";
import { failureText, readProblem } from "@/shared/lib/read-problem";

// Die Zeilen der schon verbundenen Anbieter zu api-keys.tsx. Entfernen fragt nach: der Key ist verschlüsselt
// gespeichert und wird nie wieder angezeigt, wer ihn nicht mehr hat, braucht beim Anbieter einen neuen.

/** Der Papierkorb einer Zeile. Erst die Rückfrage ruft `onRemove`; der Dialog schliesst sich, wenn es durch ist. */
function RemoveKeyButton({
  label,
  testId,
  title,
  description,
  busy,
  onRemove,
}: {
  label: string;
  testId?: string;
  title: string;
  description: string;
  /** Die Zeile arbeitet gerade (auch am Aktivieren): Knopf und Dialog sind gesperrt. */
  busy: boolean;
  onRemove: () => Promise<void>;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-tertiary hover:text-destructive"
        onClick={() => setConfirming(true)}
        disabled={busy}
        aria-label={label}
        data-testid={testId}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={title}
        description={description}
        confirmLabel={t.settings.keys.removeConfirm}
        busyLabel={t.settings.keys.removing}
        busy={busy}
        onConfirm={() => void onRemove().finally(() => setConfirming(false))}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

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

  // Schaltet um, welcher gespeicherte Key abgerechnet wird. Der Server tauscht in einem Schritt
  // (set_active_byok_provider_for), es gibt nie zwei aktive Keys oder keinen.
  async function activate() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw await readProblem(res, t.settings.keys.activateFailed);
      toast({ title: fmt(t.settings.keys.activated, { name: meta.name }), variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.keys.activateFailedTitle,
        description: failureText(err, { network: t.common.networkError, fallback: t.settings.keys.activateFailed }),
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
      if (!res.ok) throw await readProblem(res, t.settings.keys.removeFailed);
      toast({ title: fmt(t.settings.keys.removed, { name: meta.name }), variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.keys.removeFailedTitle,
        description: failureText(err, { network: t.common.networkError, fallback: t.settings.keys.removeFailed }),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/6 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
        <ToolLogo name={meta.logo} size={16} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium text-foreground">{meta.name}</div>
        <div className="truncate text-[12px] text-tertiary">{meta.sub}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Von den verbundenen Anbietern läuft genau einer, das steht an der Zeile ("Aktiv"). */}
        {isActive ? (
          <span className="flex items-center gap-1 text-[12px] font-medium text-success">
            <Check className="h-3 w-3" />
            {t.settings.keys.active}
          </span>
        ) : canActivate ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-[12px]"
            onClick={() => void activate()}
            disabled={busy}
          >
            {t.settings.keys.activate}
          </Button>
        ) : (
          <span className="text-[12px] font-medium text-tertiary">
            {t.settings.keys.connectedState}
          </span>
        )}
        <RemoveKeyButton
          label={fmt(t.settings.keys.removeLabel, { name: meta.name })}
          testId={`remove-${provider}`}
          title={fmt(t.settings.keys.removeConfirmTitle, { name: meta.name })}
          description={t.settings.keys.removeConfirmBody}
          busy={busy}
          onRemove={remove}
        />
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
      if (!res.ok) throw await readProblem(res, t.settings.keys.removeFailed);
      toast({ title: t.settings.keys.removedPlain, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.keys.removeFailedTitle,
        description: failureText(err, { network: t.common.networkError, fallback: t.settings.keys.removeFailed }),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/6 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
        <Plug className="h-4 w-4 text-tertiary" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[13px] font-medium text-foreground">{meta.label}</div>
        <div className="truncate text-[12px] text-tertiary">{meta.model}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 text-[12px] font-medium text-success">
          <Check className="h-3 w-3" />
          {t.settings.keys.connectedState}
        </span>
        <RemoveKeyButton
          label={t.settings.keys.removeCustomLabel}
          title={fmt(t.settings.keys.removeCustomConfirmTitle, { name: meta.label })}
          description={t.settings.keys.removeCustomConfirmBody}
          busy={busy}
          onRemove={remove}
        />
      </div>
    </div>
  );
}

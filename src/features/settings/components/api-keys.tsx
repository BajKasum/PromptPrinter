"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Plug, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/toast";
import { ToolLogo } from "@/shared/brand/tool-logos";
import type { CustomProviderMeta } from "@/shared/lib/byok-types";
import {
  detectProviderFromKey,
  NAMED_PROVIDER_META,
  type NamedByokProvider,
} from "@/shared/lib/byok-detect";
import { cn } from "@/shared/lib/utils";

type AnyProvider = NamedByokProvider | "custom";

/**
 * Settings → "Eigene API-Keys" (BYOK). One field, no provider picker
 * (Nutzerwunsch 2026-09-06): paste a key, the server detects Anthropic/
 * OpenAI/Gemini from its own format (byok-detect.ts) and tests it against
 * that provider before it's ever stored, so a bad key surfaces right here as
 * a save error, never silently at the next generation. Below the field, one
 * row per provider the user has ALREADY connected (not four always-visible
 * empty slots), each with the same Aktiv/Aktivieren/remove controls as
 * before. A de-emphasized link reveals the fallback form for any other
 * OpenAI-compatible endpoint (Z.ai, DeepSeek, Groq, OpenRouter, …), which
 * can't be auto-detected from a key string alone since it needs its own
 * base URL and model id.
 */
export function ApiKeys({
  configured,
  active,
  customProvider,
}: {
  configured: AnyProvider[];
  /** Which stored key actually runs this user's chats (Security-Audit M-6). */
  active: AnyProvider | null;
  customProvider: CustomProviderMeta | null;
}) {
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const namedConfigured = configured.filter(
    (p): p is NamedByokProvider => p !== "custom"
  );
  const hasCustom = Boolean(customProvider);

  return (
    <div className="space-y-3">
      <PrimaryKeyField
        configured={namedConfigured}
        onUnrecognized={() => setCustomFormOpen(true)}
      />

      {(namedConfigured.length > 0 || hasCustom) && (
        <div className="space-y-2">
          {namedConfigured.map((provider) => (
            <ConnectedProviderRow
              key={provider}
              provider={provider}
              isActive={active === provider}
              // Only worth offering a switch when there is something to switch to.
              canActivate={configured.length > 1}
            />
          ))}
          {hasCustom && <ConnectedCustomRow meta={customProvider as CustomProviderMeta} />}
        </div>
      )}

      {!hasCustom &&
        (customFormOpen ? (
          <CustomProviderForm onCancel={() => setCustomFormOpen(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setCustomFormOpen(true)}
            className="text-[12px] text-tertiary underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Anderer Anbieter? Eigenen Endpoint verbinden
          </button>
        ))}
    </div>
  );
}

/** The primary, provider-less field: paste a key, we figure out the rest. */
function PrimaryKeyField({
  configured,
  onUnrecognized,
}: {
  /** Named providers already connected, to flag a paste that would replace one. */
  configured: NamedByokProvider[];
  onUnrecognized: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live, purely informational — the server re-detects from the key itself
  // and never trusts this client-side guess (see route.ts).
  const detected = useMemo(() => (key.trim() ? detectProviderFromKey(key.trim()) : null), [key]);
  const willReplace = detected !== null && configured.includes(detected);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.kind === "unknownProvider") onUnrecognized();
        throw new Error(json.detail ?? "Key konnte nicht gespeichert werden.");
      }
      const name = detected ? NAMED_PROVIDER_META[detected].name : "Key";
      toast({ title: `${name} verbunden`, variant: "success" });
      setKey("");
      router.refresh();
    } catch (err) {
      toast({
        title: "Konnte nicht gespeichert werden",
        description: err instanceof Error ? err.message : "Unbekannter Fehler.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            placeholder="API-Key einfügen (Anthropic, OpenAI oder Gemini)"
            aria-label="Eigener API-Key"
            autoComplete="off"
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? "Key verbergen" : "Key anzeigen"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary transition-colors hover:text-foreground/70"
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={busy || !key.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Key hinzufügen"}
        </Button>
      </div>
      {detected && (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-tertiary">
          <ToolLogo name={NAMED_PROVIDER_META[detected].logo} size={13} />
          <span>
            Erkannt: {NAMED_PROVIDER_META[detected].name}
            {willReplace && " — ersetzt deinen bestehenden Key dafür"}
          </span>
        </div>
      )}
    </div>
  );
}

/** One row per already-connected named provider (Anthropic/OpenAI/Gemini). */
function ConnectedProviderRow({
  provider,
  isActive,
  canActivate,
}: {
  provider: NamedByokProvider;
  isActive: boolean;
  canActivate: boolean;
}) {
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
        throw new Error(json.detail ?? "Key konnte nicht aktiviert werden.");
      }
      toast({ title: `${meta.name} ist jetzt aktiv`, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Konnte nicht aktiviert werden",
        description: err instanceof Error ? err.message : "Unbekannter Fehler.",
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
        throw new Error(json.detail ?? "Key konnte nicht entfernt werden.");
      }
      toast({ title: `${meta.name} entfernt`, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Konnte nicht entfernt werden",
        description: err instanceof Error ? err.message : "Unbekannter Fehler.",
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
            Aktiv
          </span>
        ) : canActivate ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-[11px]"
            onClick={() => void activate()}
            disabled={busy}
          >
            Aktivieren
          </Button>
        ) : (
          <span className="text-[11px] font-medium text-tertiary">Verbunden</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-tertiary hover:text-destructive"
          onClick={() => void remove()}
          disabled={busy}
          aria-label={`${meta.name}-Key entfernen`}
          data-testid={`remove-${provider}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/** The connected state of the generic "custom" endpoint slot. */
function ConnectedCustomRow({ meta }: { meta: CustomProviderMeta }) {
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
        throw new Error(json.detail ?? "Key konnte nicht entfernt werden.");
      }
      toast({ title: "Entfernt", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Konnte nicht entfernt werden",
        description: err instanceof Error ? err.message : "Unbekannter Fehler.",
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
          Verbunden
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-tertiary hover:text-destructive"
          onClick={() => void remove()}
          disabled={busy}
          aria-label="Custom-Key entfernen"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * The fallback slot: any OpenAI-compatible chat/completions endpoint (Z.ai,
 * DeepSeek, Groq, OpenRouter, a self-hosted gateway, …), reached via the
 * "Anderer Anbieter?" link since it can't be auto-detected from a key alone —
 * there's no built-in name/model, so the user supplies a label (just for
 * display), the endpoint URL, and the model id alongside the key.
 */
function CustomProviderForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSave = label.trim() && baseUrl.trim() && model.trim() && key.trim();

  function reset() {
    setLabel("");
    setBaseUrl("");
    setModel("");
    setKey("");
  }

  function cancel() {
    reset();
    onCancel();
  }

  async function save() {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "custom",
          label: label.trim(),
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          apiKey: key.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Key konnte nicht gespeichert werden.");
      toast({ title: `${label.trim()} verbunden`, variant: "success" });
      reset();
      onCancel();
      router.refresh();
    } catch (err) {
      toast({
        title: "Konnte nicht gespeichert werden",
        description: err instanceof Error ? err.message : "Unbekannter Fehler.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-xl border border-border bg-surface px-3 py-2.5")}>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
          <Plug className="h-4 w-4 text-tertiary" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium text-foreground">Anderer Anbieter</div>
          <div className="truncate text-[11px] text-tertiary">
            Jeder OpenAI-kompatible Endpoint, z. B. Z.ai
          </div>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name (z. B. Z.ai)"
            autoComplete="off"
            autoFocus
          />
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Modell (z. B. glm-4.6)"
            autoComplete="off"
          />
        </div>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="API-Endpoint (z. B. https://api.z.ai/api/paas/v4/chat/completions)"
          autoComplete="off"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") cancel();
              }}
              placeholder="API-Key"
              autoComplete="off"
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Key verbergen" : "Key anzeigen"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary transition-colors hover:text-foreground/70"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button size="sm" onClick={() => void save()} disabled={busy || !canSave}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Speichern"}
          </Button>
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

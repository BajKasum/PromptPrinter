"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Plug, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ToolLogo } from "@/components/brand/tool-logos";
import type { CustomProviderMeta } from "@/lib/byok";
import { cn } from "@/lib/utils";

type Provider = "anthropic" | "openai" | "gemini";
type AnyProvider = Provider | "custom";

const PROVIDERS: { id: Provider; logo: string; name: string; sub: string }[] = [
  { id: "anthropic", logo: "Claude", name: "Anthropic", sub: "Claude" },
  { id: "openai", logo: "ChatGPT", name: "OpenAI", sub: "GPT" },
  { id: "gemini", logo: "Gemini", name: "Google", sub: "Gemini" },
];

/**
 * Settings → "Eigene API-Keys" (BYOK). One row per named provider — connected
 * ones show a quiet "Verbunden" state with a remove action; the rest offer an
 * inline key field. Below them, one generic "Custom" row covers any other
 * OpenAI-compatible endpoint (Z.ai, DeepSeek, Groq, OpenRouter, …) via a
 * user-supplied label/endpoint/model instead of a fixed name. Every key is
 * tested against its real provider server-side (api/settings/api-key) before
 * it's ever stored, so a bad key surfaces right here as a save error, never
 * silently at the next generation.
 */
export function ApiKeys({
  configured,
  customProvider,
}: {
  configured: AnyProvider[];
  customProvider: CustomProviderMeta | null;
}) {
  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => (
        <ProviderRow key={p.id} provider={p} connected={configured.includes(p.id)} />
      ))}
      <CustomProviderRow connected={customProvider} />
    </div>
  );
}

function ProviderRow({
  provider,
  connected,
}: {
  provider: { id: Provider; logo: string; name: string; sub: string };
  connected: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Key konnte nicht gespeichert werden.");
      toast({ title: `${provider.name} verbunden`, variant: "success" });
      setEditing(false);
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

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/api-key?provider=${provider.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.detail ?? "Key konnte nicht entfernt werden.");
      }
      toast({ title: `${provider.name} entfernt`, variant: "success" });
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
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        connected ? "border-success/30 bg-success/[0.06]" : "border-border bg-surface"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
          <ToolLogo name={provider.logo} size={16} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium text-foreground">{provider.name}</div>
          <div className="truncate text-[11px] text-foreground/40">{provider.sub}</div>
        </div>

        {connected ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-medium text-success">
              <Check className="h-3 w-3" />
              Verbunden
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground/40 hover:text-destructive"
              onClick={() => void remove()}
              disabled={busy}
              aria-label={`${provider.name}-Key entfernen`}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : !editing ? (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            Key hinzufügen
          </Button>
        ) : null}
      </div>

      {!connected && editing && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") {
                  setEditing(false);
                  setKey("");
                }
              }}
              placeholder={`${provider.name}-API-Key`}
              autoComplete="off"
              autoFocus
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Key verbergen" : "Key anzeigen"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/35 transition-colors hover:text-foreground/70"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button size="sm" onClick={() => void save()} disabled={busy || !key.trim()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Speichern"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setKey("");
            }}
            disabled={busy}
          >
            Abbrechen
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The generic slot: any OpenAI-compatible chat/completions endpoint (Z.ai,
 * DeepSeek, Groq, OpenRouter, a self-hosted gateway, …). Unlike the fixed
 * rows above there's no built-in name/model, so the user supplies a label
 * (just for display), the endpoint URL, and the model id alongside the key.
 */
function CustomProviderRow({ connected }: { connected: CustomProviderMeta | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSave = label.trim() && baseUrl.trim() && model.trim() && key.trim();

  function resetForm() {
    setEditing(false);
    setLabel("");
    setBaseUrl("");
    setModel("");
    setKey("");
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
      resetForm();
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
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        connected ? "border-success/30 bg-success/[0.06]" : "border-border bg-surface"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
          <Plug className="h-4 w-4 text-foreground/50" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium text-foreground">
            {connected ? connected.label : "Custom"}
          </div>
          <div className="truncate text-[11px] text-foreground/40">
            {connected ? connected.model : "Jeder OpenAI-kompatible Endpoint, z. B. Z.ai"}
          </div>
        </div>

        {connected ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-medium text-success">
              <Check className="h-3 w-3" />
              Verbunden
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground/40 hover:text-destructive"
              onClick={() => void remove()}
              disabled={busy}
              aria-label="Custom-Key entfernen"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : !editing ? (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setEditing(true)}>
            Key hinzufügen
          </Button>
        ) : null}
      </div>

      {!connected && editing && (
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
                  if (e.key === "Escape") resetForm();
                }}
                placeholder="API-Key"
                autoComplete="off"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Key verbergen" : "Key anzeigen"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/35 transition-colors hover:text-foreground/70"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button size="sm" onClick={() => void save()} disabled={busy || !canSave}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Speichern"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm} disabled={busy}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

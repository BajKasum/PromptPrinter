"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Plug } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/toast";
import { ApiKeyField } from "@/shared/ui/api-key-field";
import { KeyGuide } from "@/shared/ui/key-guide";
import type { CustomProviderMeta } from "@/shared/lib/byok-types";
import type { NamedByokProvider } from "@/shared/lib/byok-detect";
import { cn } from "@/shared/lib/utils";
import {
  ConnectedCustomRow,
  ConnectedProviderRow,
} from "@/features/settings/components/connected-key-rows";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

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
  const t = useT();
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const namedConfigured = configured.filter(
    (p): p is NamedByokProvider => p !== "custom"
  );
  const hasCustom = Boolean(customProvider);

  return (
    <div className="space-y-3">
      <ApiKeyField
        configured={namedConfigured}
        onUnrecognized={() => setCustomFormOpen(true)}
      />

      {/* Wer noch keinen Key hat, findet hier den Weg zu einem kostenlosen
          (Audit 23.09.2026, P-1). Nur solange nichts verbunden ist: danach
          waere die Anleitung Rauschen. */}
      {namedConfigured.length === 0 && !hasCustom && (
        <details className="group rounded-xl border border-border bg-surface px-3 py-2.5">
          <summary className="cursor-pointer list-none text-[12.5px] font-medium text-secondary transition-colors hover:text-foreground">
            {t.keyGuide.summary}
          </summary>
          <div className="mt-3">
            <KeyGuide />
          </div>
        </details>
      )}

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
            {t.settings.keys.otherProvider}
          </button>
        ))}
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
  const t = useT();
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
      if (!res.ok) throw new Error(json.detail ?? t.settings.keys.saveFailed);
      toast({ title: fmt(t.settings.keys.connected, { name: label.trim() }), variant: "success" });
      reset();
      onCancel();
      router.refresh();
    } catch (err) {
      toast({
        title: t.settings.saveFailed,
        description: err instanceof Error ? err.message : t.common.unknownError,
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
          <div className="truncate text-[13px] font-medium text-foreground">
            {t.settings.keys.otherTitle}
          </div>
          <div className="truncate text-[11px] text-tertiary">{t.settings.keys.otherHint}</div>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.settings.keys.namePlaceholder}
            aria-label={t.settings.keys.nameLabel}
            autoComplete="off"
            autoFocus
          />
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={t.settings.keys.modelPlaceholder}
            aria-label={t.settings.keys.modelLabel}
            autoComplete="off"
          />
        </div>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={t.settings.keys.endpointPlaceholder}
          aria-label={t.settings.keys.endpointLabel}
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
              placeholder={t.settings.keys.keyPlaceholder}
              aria-label={t.settings.keys.keyPlaceholder}
              autoComplete="off"
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? t.settings.keys.hide : t.settings.keys.show}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary transition-colors hover:text-foreground/70"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button size="sm" onClick={() => void save()} disabled={busy || !canSave}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.common.save}
          </Button>
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}

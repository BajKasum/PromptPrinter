"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/toast";
import { ToolLogo } from "@/shared/brand/tool-logos";
import {
  detectProviderFromKey,
  NAMED_PROVIDER_META,
  type NamedByokProvider,
} from "@/shared/lib/byok-detect";
import { useT } from "@/shared/i18n/provider";
import { fmt } from "@/shared/i18n/format";

/**
 * Das Key-Feld ohne Anbieterwahl: Key einfügen, der Server erkennt den
 * Anbieter am Format (byok-detect.ts) und testet den Key, bevor er gespeichert
 * wird.
 *
 * Liegt in shared/, weil zwei Features es brauchen und einander nicht kennen
 * dürfen: die Einstellungen (Karte "Eigene API-Keys") und der Chat (Key-
 * Hinweis im leeren Chat, Audit 23.09.2026 F-1, mit Anleitung für einen
 * kostenlosen Gemini-Key). Vorher war es eine private Funktion in
 * features/settings/components/api-keys.tsx.
 */
export function ApiKeyField({
  configured,
  onUnrecognized,
  onConnected,
}: {
  /** Named providers already connected, to flag a paste that would replace one. */
  configured: NamedByokProvider[];
  /** Der Server erkennt den Anbieter nicht (z. B. ein Z.ai-Key). */
  onUnrecognized: () => void;
  /** Nach dem erfolgreichen Speichern, vor dem Neuladen der Seite. */
  onConnected?: () => void;
}) {
  const t = useT();
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
        throw new Error(json.detail ?? t.settings.keys.saveFailed);
      }
      const name = detected ? NAMED_PROVIDER_META[detected].name : t.settings.keys.fallbackName;
      toast({ title: fmt(t.settings.keys.connected, { name }), variant: "success" });
      setKey("");
      onConnected?.();
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
            placeholder={t.settings.keys.placeholder}
            aria-label={t.settings.keys.label}
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
        <Button size="sm" onClick={() => void save()} disabled={busy || !key.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.settings.keys.add}
        </Button>
      </div>
      {detected && (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-tertiary">
          <ToolLogo name={NAMED_PROVIDER_META[detected].logo} size={13} />
          <span>
            {fmt(t.settings.keys.detected, { name: NAMED_PROVIDER_META[detected].name })}
            {willReplace && t.settings.keys.replaces}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { fmt } from "@/shared/i18n/format";

/**
 * Die Zustimmung zur Übermittlung an Z.ai in den Einstellungen: ansehen,
 * erteilen, widerrufen (server/consent.ts, Rechts-Audit R-1). Widerrufen muss so
 * leicht sein wie Zustimmen; der Chat fragt beim nächsten Zug auf dem
 * Server-Key neu. Eigene Keys sind davon nie betroffen.
 */
export function ZaiConsent({ consentAt }: { consentAt: string | null }) {
  const t = useT();
  const locale = useLocale();
  const [at, setAt] = useState<string | null>(consentAt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const c = t.settings.zaiConsent;

  async function change(grant: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/consent/zai", { method: grant ? "POST" : "DELETE" });
      if (!res.ok) {
        setMessage(c.failed);
        return;
      }
      setAt(grant ? new Date().toISOString() : null);
      setMessage(grant ? null : c.withdrawn);
    } catch {
      setMessage(c.failed);
    } finally {
      setBusy(false);
    }
  }

  const date = at ? new Intl.DateTimeFormat(LOCALE_TAGS[locale].intl, { dateStyle: "long" }).format(new Date(at)) : "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-relaxed text-secondary" role={message ? "status" : undefined}>
        {message ?? (at ? fmt(c.granted, { date }) : c.notGranted)}
      </p>
      <Button
        variant="ghost"
        className="shrink-0"
        onClick={() => void change(!at)}
        disabled={busy}
      >
        {at ? c.withdraw : c.grant}
      </Button>
    </div>
  );
}

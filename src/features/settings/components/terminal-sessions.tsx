"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { useLocale, useT } from "@/shared/i18n/provider";
import { LOCALE_TAGS } from "@/shared/i18n/locales";
import { fmt } from "@/shared/i18n/format";

type TerminalSession = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

/**
 * Die angemeldeten Terminals dieses Kontos, jedes einzeln abzumelden (api/cli/sessions). Ein Gerät hier abzumelden beendet
 * seine Sitzung sofort; die Abmeldung im Kontomenü beendet dagegen alle Sitzungen des Kontos, das sagt der Hinweis unten.
 */
export function TerminalSessions() {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const c = t.settings.terminalSessions;
  const [sessions, setSessions] = useState<TerminalSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/cli/sessions");
        const body = (await res.json().catch(() => null)) as { sessions?: TerminalSession[] } | null;
        if (cancelled) return;
        if (res.ok && Array.isArray(body?.sessions)) setSessions(body.sessions);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function revoke(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/cli/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      // 404 heisst: schon weg. Das Ziel ist erreicht, die Zeile verschwindet genauso.
      if (res.ok || res.status === 404) {
        setSessions((current) => current?.filter((session) => session.id !== id) ?? null);
        toast({ title: c.revoked, variant: "success" });
      } else {
        toast({ title: c.failed, variant: "error" });
      }
    } catch {
      toast({ title: c.failed, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const date = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale].intl, { dateStyle: "medium" }).format(new Date(iso));

  return (
    <div className="space-y-3">
      {failed && <p className="text-[13px] text-secondary" role="status">{c.loadFailed}</p>}
      {!failed && sessions === null && <Loader2 className="h-4 w-4 animate-spin text-tertiary" aria-hidden />}
      {sessions?.length === 0 && <p className="text-[13px] text-secondary">{c.empty}</p>}
      {sessions && sessions.length > 0 && (
        <ul className="divide-y divide-border">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-[14px] font-medium text-foreground">{session.clientName || c.unnamed}</p>
                <p className="mt-0.5 text-[12.5px] text-secondary">
                  {fmt(c.signedInAt, { date: date(session.createdAt) })} · {fmt(c.lastUsed, { date: date(session.lastUsedAt) })}
                </p>
                <p className="text-[12.5px] text-secondary">{fmt(c.validUntil, { date: date(session.expiresAt) })}</p>
              </div>
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() => void revoke(session.id)}
                disabled={busy !== null}
                aria-label={`${c.revoke}: ${session.clientName || c.unnamed}`}
              >
                {busy === session.id ? c.revoking : c.revoke}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-tertiary">{c.signOutNote}</p>
    </div>
  );
}

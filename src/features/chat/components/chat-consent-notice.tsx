"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useT } from "@/shared/i18n/provider";

// Im Pro-Plan geht jede Nachricht an Z.ai (Singapur). Dafür braucht das Konto vorher eine ausdrückliche
// Zustimmung (server/consent.ts, Rechts-Audit R-1). Der Server prüft sie bei jedem Zug; antwortet er mit
// 403 consentRequired, steht dieser Hinweis an der Stelle des Fehlerbanners, die getippte Nachricht wartet
// im Eingabefeld. "Einverstanden und senden" speichert die Zustimmung und schickt sie gleich ab.
export function ChatConsentNotice({ onGranted }: { onGranted: () => Promise<void> | void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function accept() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/consent/zai", { method: "POST" });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      await onGranted();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="chat-consent-notice-title"
      className="rounded-2xl border border-accent/30 bg-accent-subtle px-4 py-4 md:px-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p id="chat-consent-notice-title" role="status" className="text-[14px] font-medium text-foreground">
            {t.chat.consentTitle}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-secondary">
            {t.chat.consentBody}{" "}
            <a
              href="/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2"
            >
              {t.chat.consentPrivacy}
            </a>
          </p>

          {failed && (
            <p role="alert" className="mt-2 text-[13px] text-destructive">
              {t.chat.consentFailed}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void accept()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : t.chat.consentAccept}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/settings#api-keys">{t.chat.consentOwnKey}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

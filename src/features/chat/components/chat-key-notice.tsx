"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ApiKeyField } from "@/shared/ui/api-key-field";
import { KeyGuide } from "@/shared/ui/key-guide";
import { useT } from "@/shared/i18n/provider";

// Free chattet seit 30.07.2026 nur mit eigenem Key (plans.ts). Vorher erfuhr
// ein neues Free-Konto das erst NACH dem Absenden seiner ersten Idee, als rote
// Fehlermeldung mit einem "Erneut senden"-Knopf, der denselben 403 nur
// wiederholte (Audit 23.09.2026, F-1). Dieser Hinweis steht jetzt schon im
// leeren Chat und ersetzt nach einer 403-Antwort den Fehlerbanner.
//
// Seit 01.10.2026 (Audit P-1) führt er nicht mehr nur zu den Einstellungen,
// sondern erklärt den Weg zu einem kostenlosen Gemini-Key und nimmt den Key
// gleich hier an: ein neuer Nutzer verliert den Chat nicht aus den Augen, und
// die getippte Idee wartet im Eingabefeld, bis der Key steht.
export function ChatKeyNotice({ onConnected }: { onConnected?: () => void }) {
  const t = useT();
  return (
    <section
      aria-labelledby="chat-key-notice-title"
      className="rounded-2xl border border-accent/30 bg-accent-subtle px-4 py-4 md:px-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text">
          <KeyRound className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            id="chat-key-notice-title"
            role="status"
            className="text-[14px] font-medium text-foreground"
          >
            {t.chat.keyNoticeTitle}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-secondary">{t.chat.keyNoticeBody}</p>

          <div className="mt-3">
            <KeyGuide
              field={
                <ApiKeyField
                  configured={[]}
                  // Der Server erkennt den Anbieter nicht (z. B. ein Z.ai-Key):
                  // die Fehlermeldung nennt die erweiterte Option, der Link
                  // darunter führt dorthin. Hier gibt es kein Formular dafür.
                  onUnrecognized={() => {}}
                  onConnected={onConnected}
                />
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/billing">{t.chat.keyNoticeSeePro}</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/settings#api-keys">{t.chat.keyNoticeSettings}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

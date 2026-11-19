"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ApiKeyField } from "@/shared/ui/api-key-field";
import { KeyGuide } from "@/shared/ui/key-guide";
import { useT } from "@/shared/i18n/provider";

// Nach den Gratis-Prompts chattet ein Konto nur mit eigenem Key (shared/lib/plans.ts, server/free-trial.ts). Der
// Hinweis steht deshalb schon im leeren Chat, nicht erst als Fehler nach dem Absenden, und ersetzt nach einer
// 403-Antwort den Fehlerbanner: ein "Erneut senden" bekäme nur wieder dieselbe Ablehnung.
//
// Er erklärt den Weg zu einem kostenlosen Gemini-Key und nimmt den Key gleich hier an: der Chat bleibt im Blick,
// und die getippte Idee wartet im Eingabefeld, bis der Key steht.
export function ChatKeyNotice({ onConnected, reason = null }: { onConnected?: () => void; reason?: string | null }) {
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
          {reason && <p className="mt-1 text-[13px] leading-relaxed text-foreground">{reason}</p>}
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
              <Link href="/settings#api-keys">{t.chat.keyNoticeSettings}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

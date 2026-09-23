import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/shared/ui/button";

// Free chattet seit 30.07.2026 nur mit eigenem Key (plans.ts). Vorher erfuhr
// ein neues Free-Konto das erst NACH dem Absenden seiner ersten Idee, als rote
// Fehlermeldung mit einem "Erneut senden"-Knopf, der denselben 403 nur
// wiederholte (Audit 23.09.2026, F-1). Dieser Hinweis steht jetzt schon im
// leeren Chat und ersetzt nach einer 403-Antwort den Fehlerbanner, mit den
// zwei Wegen, die tatsaechlich weiterfuehren.
export function ChatKeyNotice() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-accent/30 bg-accent-subtle px-4 py-4 md:px-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text">
          <KeyRound className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-foreground">
            Bevor wir loslegen, brauche ich deinen eigenen KI-Key.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-secondary">
            Auf Free laufe ich über deinen Key von Anthropic, OpenAI oder Gemini. Einmal
            hinterlegt, ist die App für dich komplett gratis. Keine Lust auf einen Key? Mit Pro
            übernehme ich das für dich.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="accent">
              <Link href="/settings#api-keys">Key hinterlegen</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/billing">Pro ansehen</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

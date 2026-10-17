import "server-only";

import { captureError, logWarning } from "@/shared/lib/observability";

/**
 * Versand einzelner Mails über die HTTP-Schnittstelle von Resend.
 *
 * Die Auth-Mails (Passwort zurücksetzen, Bestätigung) laufen NICHT hierüber,
 * sondern über den SMTP-Zugang, den Supabase selbst bedient. Das hier ist der
 * eigene Versand der App, bisher nur für das Kontaktformular.
 *
 * ⚠️ Beides teilt sich ein Konto und damit das Tageslimit von Resend (Gratis:
 * 100 Mails am Tag, 3000 im Monat). Wer über diesen Weg Mails erzeugen kann,
 * kann den Reset-Link anderer Nutzer verdrängen. Deshalb hat jede Route, die
 * hierher sendet, ein eigenes Tageslimit (siehe /api/contact).
 *
 * Ohne `RESEND_API_KEY` sendet das Modul nichts und sagt es: kein stiller
 * Erfolg, damit ein Formular nie "gesendet" meldet, wenn nichts ankam.
 */

const RESEND_URL = "https://api.resend.com/emails";

/** Obergrenze, wie lange eine hängende Verbindung die Anfrage offen halten darf. */
const TIMEOUT_MS = 10_000;

/** Die Domain ist in Resend verifiziert (promptprinter.app). */
export const MAIL_FROM = "PromptPrinter <noreply@promptprinter.app>";

export type MailResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "rejected" | "unreachable" };

export function mailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

export async function sendMail(mail: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not-configured" };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [mail.to],
        reply_to: mail.replyTo,
        // Ein Zeilenumbruch im Betreff wäre ein Weg, Kopfzeilen einzuschleusen.
        subject: mail.subject.replace(/[\r\n]+/g, " ").slice(0, 200),
        text: mail.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Nur der Status ins Log: der Antworttext kann Adressen aus der Mail enthalten.
      logWarning("mail.rejected", { status: res.status });
      return { ok: false, reason: "rejected" };
    }
    return { ok: true };
  } catch (err) {
    captureError("mail.unreachable", err);
    return { ok: false, reason: "unreachable" };
  }
}

import { NextResponse } from "next/server";
import { z, responseIssues } from "@/shared/lib/zod";
import { problem } from "@/server/http/api-problem";
import { rateLimit, rateLimitKey, clientIp } from "@/server/security/rate-limit";
import { verifyTurnstileToken, MAX_TURNSTILE_TOKEN_CHARS } from "@/server/security/turnstile";
import {
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  readJsonBody,
} from "@/server/http/request-body";
import { mailConfigured, sendMail } from "@/server/mail/resend";
import { CONTACT_TOPIC_LABELS, contactSchema } from "@/shared/lib/contact";
import { LEGAL } from "@/shared/lib/legal";
import { logWarning } from "@/shared/lib/observability";

export const runtime = "nodejs";

/**
 * Das Kontaktformular auf /kontakt: eine Nachricht, per Mail an den Betreiber.
 *
 * Anonym, deshalb wie /api/auth gebaut: erst das Ratenlimit (billig, vor dem
 * Lesen des Körpers), dann Körper und Schema, dann die Mensch-Prüfung, dann der
 * Versand. Nichts wird gespeichert, die Nachricht liegt danach nur im Postfach
 * des Betreibers (und 30 Tage im Versandprotokoll von Resend).
 *
 * Zwei Grenzen, weil der Versand an den Resend-Zugang der Auth-Mails gekoppelt
 * ist (siehe server/mail/resend.ts): fünf Nachrichten pro Stunde und Adresse,
 * und zwanzig am Tag insgesamt. Ohne die zweite könnte ein Schwarm das
 * Tageslimit von Resend aufbrauchen und damit den Reset-Link echter Nutzer
 * verdrängen.
 */
const PER_IP = { limit: 5, windowMs: 60 * 60 * 1000 };
const PER_DAY = { limit: 20, windowMs: 24 * 60 * 60 * 1000 };

const requestSchema = contactSchema.extend({
  turnstileToken: z.string().max(MAX_TURNSTILE_TOKEN_CHARS).optional(),
});

export async function POST(req: Request) {
  const rl = await rateLimit(`contact:${rateLimitKey(req)}`, PER_IP);
  if (!rl.allowed) {
    return problem(429, "Du hast gerade mehrere Nachrichten geschickt. Bitte warte etwas und versuch es später erneut.", {
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  let body: unknown;
  try {
    body = await readJsonBody(req, MAX_SMALL_BODY_BYTES);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) return problem(413, "Die Nachricht ist zu gross.");
    return problem(400, "Invalid JSON body");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Bitte prüf deine Angaben: eine gültige E-Mail-Adresse und eine Nachricht von mindestens 10 Zeichen.", {
      issues: responseIssues(parsed.error.issues),
    });
  }
  const input = parsed.data;

  // Köderfeld gefüllt: ein Bot. Wie ein Erfolg antworten, nichts senden.
  if (input.website) return NextResponse.json({ ok: true });

  const verdict = await verifyTurnstileToken(input.turnstileToken, clientIp(req));
  if (!verdict.ok) {
    logWarning("turnstile.rejected", { action: "contact", reason: verdict.reason });
    return problem(
      403,
      "Die Mensch-Prüfung ist fehlgeschlagen. Bitte lade die Seite neu und versuch es erneut.",
      { kind: "captcha" }
    );
  }

  if (!mailConfigured()) {
    return problem(503, `Das Formular ist gerade nicht verfügbar. Schreib mir bitte direkt an ${LEGAL.email}.`);
  }

  const day = await rateLimit("contact:all", PER_DAY);
  if (!day.allowed) {
    return problem(503, `Heute sind schon viele Nachrichten angekommen. Schreib mir bitte direkt an ${LEGAL.email}.`);
  }

  const topic = CONTACT_TOPIC_LABELS[input.topic];
  const sender = input.name ? `${input.name} <${input.email}>` : input.email;
  const sent = await sendMail({
    to: LEGAL.email,
    replyTo: input.email,
    subject: `Kontakt: ${topic}`,
    text: `Neue Nachricht über das Kontaktformular\n\nThema: ${topic}\nVon: ${sender}\n\n${input.message}\n`,
  });
  if (!sent.ok) {
    return problem(502, `Die Nachricht konnte nicht gesendet werden. Schreib mir bitte direkt an ${LEGAL.email}.`);
  }

  // Eine Meldung rechtswidriger Inhalte (Digital Services Act, Art. 16 Abs. 4) wird dem Absender
  // bestätigt. Nur dann: eine Bestätigung an eine Adresse, die jemand ins Formular tippt, wäre sonst
  // ein Weg, einem Dritten Mails zuzustellen. Der Text gibt die Nachricht nicht wieder. Scheitert die
  // Bestätigung, ist die Meldung trotzdem angekommen: kein Fehler für den Absender, nur ein Logeintrag.
  if (input.topic === "melden") {
    const ack = await sendMail({
      to: input.email,
      subject: "Deine Meldung ist angekommen",
      text:
        "Hallo,\n\ndeine Meldung über das Formular auf promptprinter.app ist bei mir angekommen. " +
        "Ich sehe sie mir an und teile dir meine Entscheidung mit.\n\n" +
        "Falls du diese Meldung nicht selbst geschickt hast, kannst du diese Mail ignorieren.\n\n" +
        `${LEGAL.operator}\nPromptPrinter\n`,
    });
    if (!ack.ok) logWarning("contact.ack_failed", { reason: ack.reason });
  }

  return NextResponse.json({ ok: true });
}

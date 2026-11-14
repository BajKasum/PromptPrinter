import "server-only";

import { createHash } from "node:crypto";
import { logWarning } from "@/shared/lib/observability";
import { reserveCounter } from "@/server/security/reserve-counter";

// Das Limit je Adresse hält einen Angreifer mit vielen Adressen nicht auf, der ein Konto rät: das Konto ist der
// Schlüssel, den er nicht wechseln kann. Das gilt nur für /api/auth: den Passwort-Grant von Supabase Auth erreicht man mit
// dem Anon-Key auch direkt, dort greift nur dessen Grenze je IP (docs/SETUP.md, "Anmelden: Sperre je Konto").
// Es zählt nur Fehlversuche, damit fremde Anmeldungen mit richtigem Passwort
// niemanden sperren, und ein Erfolg setzt nichts zurück: sonst räumte jede Anmeldung des Opfers den Zähler eines
// laufenden Angriffs ab.
//
// Eine feste Sperre mit Ablauf, kein wachsender Abstand: gesperrte Versuche zählen nicht, nach dem Fenster ist das
// Konto von selbst wieder frei. Wer die Sperre durch stetes Raten aufrechthält, sperrt nur das Passwort: Reset und OAuth bleiben offen.
//
// Jeder Versuch reserviert seinen Platz VOR dem Aufruf bei Supabase (ein INCR), statt erst zu lesen und danach zu
// zählen: sonst kämen gleichzeitige Versuche alle an einer Prüfung vorbei, die noch keinen von ihnen sah. Ein
// Versuch, der nicht an falschen Zugangsdaten scheitert, gibt seinen Platz zurück.
const MAX_FAILED_SIGN_INS = 10;
const WINDOW_SECONDS = 15 * 60;

/** Gehasht, damit Redis keine Adressen führt. Unbekannte Adressen zählen genauso, die Sperre verrät kein Konto. */
function throttleKey(email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `auth-failed-sign-ins:${digest}`;
}

export type SignInAttempt = {
  throttled: boolean;
  /** Nach dem Aufruf: `failed` heisst falsche Zugangsdaten, dann bleibt der Platz belegt, sonst geht er zurück. */
  settle: (failed: boolean) => Promise<void>;
};

/** Ohne Redis oder bei einem Redis-Fehler: nicht gesperrt, das Limit je Adresse gilt weiter (fail open). */
export async function reserveSignInAttempt(email: string): Promise<SignInAttempt> {
  const reservation = await reserveCounter({
    key: throttleKey(email),
    limit: MAX_FAILED_SIGN_INS,
    ttlSeconds: WINDOW_SECONDS,
  });
  if (!reservation) return { throttled: false, settle: async () => {} };
  if (!reservation.allowed) {
    await reservation.release();
    logWarning("auth.sign_in_throttled", { limit: MAX_FAILED_SIGN_INS });
    return { throttled: true, settle: async () => {} };
  }
  return {
    throttled: false,
    settle: async (failed) => {
      if (!failed) await reservation.release();
    },
  };
}

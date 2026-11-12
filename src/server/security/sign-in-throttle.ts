import "server-only";

import { createHash } from "node:crypto";
import { logWarning } from "@/shared/lib/observability";
import { redis } from "@/server/security/redis-client";
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
const MAX_FAILED_SIGN_INS = 10;
const WINDOW_SECONDS = 15 * 60;

/** Gehasht, damit Redis keine Adressen führt. Unbekannte Adressen zählen genauso, die Sperre verrät kein Konto. */
function throttleKey(email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `auth-failed-sign-ins:${digest}`;
}

/** Ohne Redis oder bei einem Redis-Fehler: nicht gesperrt, das Limit je Adresse gilt weiter (fail open). */
export async function isSignInThrottled(email: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const failed = Number((await redis.get<number>(throttleKey(email))) ?? 0);
    if (failed < MAX_FAILED_SIGN_INS) return false;
    logWarning("auth.sign_in_throttled", { failed });
    return true;
  } catch {
    return false;
  }
}

export async function recordFailedSignIn(email: string): Promise<void> {
  await reserveCounter({ key: throttleKey(email), limit: MAX_FAILED_SIGN_INS, ttlSeconds: WINDOW_SECONDS });
}

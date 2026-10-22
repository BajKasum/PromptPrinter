// Hat sich die Person gerade erst angemeldet? (#132)
//
// `DELETE /api/account` loescht das Konto samt Chats, Projekten, Dateien und Keys unwiderruflich. Der Server
// prueft sonst nur getUser(): "irgendeine gueltige Sitzung". Das Sitzungs-Cookie ist aber bewusst nicht httpOnly
// (createBrowserClient muss es lesen, siehe recovery-session.ts und server/supabase/cookie-options.ts). Ein
// ausgelesenes Cookie, ein offener Rechner oder ein geteiltes Geraet genuegt damit, alle Daten eines Nutzers
// endgueltig zu vernichten, und das Ratenlimit (5 je Stunde) hilft nicht, ein einziger Aufruf reicht.
//
// Wie bei der Seite "Neues Passwort" (recovery-session.ts) traegt GoTrue in jedes JWT eine AMR-Liste ein, Eintraege
// `{ method, timestamp }` (Sekunden). Der `timestamp` eines Eintrags ist der Zeitpunkt der letzten Anmeldung mit
// genau dieser Methode (Passwort, OAuth, Mail-Link). Eine Sitzung, die vor Tagen entstand und nur erneuert wurde,
// traegt dort ein altes Datum; wer das Konto loeschen will, meldet sich vorher erneut an.
//
// ─── `token_refresh` zaehlt nicht ───────────────────────────────────────────
// GoTrue haengt beim Erneuern des Zugriffstokens (stuendlich) einen Eintrag `token_refresh` mit dem Zeitpunkt der
// Erneuerung an. Er belegt keine Anmeldung, sondern nur, dass die Sitzung lebt. Zaehlte er mit, waere jede Sitzung
// im Schnitt eine halbe Stunde "frisch" und die Pruefung wirkungslos.

/** So lange nach einer Anmeldung darf das Konto noch geloescht werden. */
export const FRESH_SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

/** Die Uhren von GoTrue und Server gehen etwas auseinander: ein Zeitpunkt knapp in der Zukunft ist kein Betrug. */
const CLOCK_SKEW_MS = 60 * 1000;

const NOT_A_SIGN_IN = new Set(["token_refresh"]);

/**
 * @param amr der `amr`-Claim des JWT: Liste von `{ method, timestamp }` (Sekunden). Die Textform nach RFC 8176
 *   kennt keinen Zeitpunkt und gilt nicht als frisch.
 * @param now Uhrzeit in Millisekunden, nur fuer Tests.
 */
export function signedInRecently(amr: unknown, now: number = Date.now()): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (typeof method !== "string" || NOT_A_SIGN_IN.has(method)) return false;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;

    const age = now - timestamp * 1000;
    return age >= -CLOCK_SKEW_MS && age <= FRESH_SIGN_IN_WINDOW_MS;
  });
}

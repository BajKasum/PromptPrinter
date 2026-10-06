// Stammt diese Sitzung aus einem Passwort-Reset-Link? (Audit M-7, 06.09.2026,
// Betriebs-Audit M9, 06.10.2026.)
//
// getUser() bestätigt nur "irgendeine gültige Sitzung". Wer aus einem anderen
// Grund eine Sitzung hat (offener Rechner, geteiltes Gerät, ein gestohlenes
// Session-Cookie, das bewusst nicht httpOnly ist, weil createBrowserClient es lesen
// muss), darf damit NICHT das Passwort ändern, ohne das alte zu kennen und ohne
// Postfachzugriff: das Gegenteil dessen, was ein Passwort-Reset verspricht. GoTrue
// trägt in jedes JWT eine AMR-Liste (Authentication Methods Reference) ein, und
// genau daran erkennt die Seite "Neues Passwort", wie die Sitzung entstand.
//
// ─── Welche AMR ein Reset-Link erzeugt, hängt vom Weg ab ────────────────────
// (Quelltext von supabase/auth, internal/api/verify.go, und der Browser-Test
// e2e/password-reset.spec.ts, der es gegen den echten Stack zeigt.)
//
//   - `{{ .ConfirmationURL }}` (PKCE): GoTrue gibt einen `code` aus, die Route
//     tauscht ihn (exchangeCodeForSession). Die Sitzung trägt `recovery`. Der Link
//     geht aber NUR in dem Browser, der den Reset angefordert hat (Code-Verifier-
//     Cookie).
//   - `token_hash` + `type=recovery` (unsere Vorlage, supabase/templates/): die
//     Route löst ihn mit verifyOtp ein. Diesen Weg stellt GoTrue IMMER als `otp`
//     aus, nie als `recovery`. Dafür geht der Link auf jedem Gerät, was bei Mails
//     der Normalfall ist (Mail am Handy öffnen, Reset am Rechner angefordert).
//
// Die Seite hat bis zum 06.10.2026 nur `recovery` akzeptiert und damit den
// geräteunabhängigen Link abgewiesen: jeder Reset über unsere Vorlage endete bei
// "Link ungültig oder abgelaufen".
//
// ─── Warum `otp` akzeptiert wird, aber nur frisch ───────────────────────────
// Eine Sitzung mit `otp` entsteht in dieser App nur durch einen Klick auf einen
// Mail-Link (Anmelden läuft per Passwort oder OAuth, Magic Link und OTP-Login gibt
// es nicht). Ein Reset-Link wird unmittelbar nach dem Klick benutzt. Deshalb zählt
// `otp` nur, wenn es höchstens FRESH_OTP_WINDOW_MS alt ist: ein gestohlenes Cookie
// einer Sitzung, die vor Stunden per Mail-Link entstand, öffnet die Seite nicht.
// `recovery` gilt wie bisher ohne Alter.

/** So lange nach dem Klick auf den Link darf die Seite "Neues Passwort" noch laden. */
export const FRESH_OTP_WINDOW_MS = 10 * 60 * 1000;

/** Die Uhren von GoTrue und Server gehen etwas auseinander: ein `otp` knapp in der Zukunft ist kein Betrug. */
const CLOCK_SKEW_MS = 60 * 1000;

/**
 * @param amr der `amr`-Claim des JWT: Liste von `{ method, timestamp }` (Sekunden)
 *   oder, nach RFC 8176, von Texten.
 * @param now Uhrzeit in Millisekunden, nur für Tests.
 */
export function isRecoverySession(amr: unknown, now: number = Date.now()): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry: unknown) => {
    // Die Textform kennt keinen Zeitpunkt: nur `recovery` ist dort belegbar.
    if (typeof entry === "string") return entry === "recovery";
    if (typeof entry !== "object" || entry === null) return false;

    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (method === "recovery") return true;
    if (method !== "otp") return false;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;

    const age = now - timestamp * 1000;
    return age >= -CLOCK_SKEW_MS && age <= FRESH_OTP_WINDOW_MS;
  });
}

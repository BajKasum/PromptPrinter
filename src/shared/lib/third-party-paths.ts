/**
 * Welche Seiten welchen Drittanbieter einbinden, und wann ein Seitenwechsel ein
 * neues Dokument braucht.
 *
 * Die Content-Security-Policy gibt Cloudflare Turnstile und Lemon Squeezy nur
 * den Pfaden frei, die sie wirklich laden (server/security/csp.ts, Betriebs-Audit
 * 04.10.2026). Die Policy hängt aber an der ANTWORT, mit der das Dokument kam,
 * nicht an der Adresse, die der Browser gerade zeigt. Wechselt Next.js die Seite
 * im Browser, ohne neu zu laden (Link, `router.push`, Weiterleitung), gilt die
 * Policy der ersten Seite weiter. Wer von der Startseite zu /login geht, behält
 * deren Policy ohne Turnstile, das Skript wird gesperrt, und die Seite meldet
 * "Die Mensch-Prüfung konnte nicht geladen werden". Ebenso der Checkout, wenn man
 * aus dem Chat zu /plans wechselt, und das Abmelden (zurück zu /login). Gefunden
 * am 2026-10-17 durch Kasum, nachgestellt auf der Live-Seite.
 *
 * Die Pfadlisten stehen hier, nicht in csp.ts, weil sie auch im Browser gebraucht
 * werden (shared/providers/fresh-document-for-third-parties.tsx); csp.ts zieht sie
 * von hier. Dass die Listen zu den Seiten passen, hält
 * tests/guards/csp-third-parties.test.ts gegen den Quelltext fest.
 */
export type ThirdParties = { turnstile: boolean; lemonSqueezy: boolean };

// Exakte Pfade, keine Präfixe: /reset-password/update bindet Turnstile NICHT
// ein (update-password-experience.tsx), /reset-password schon.
const TURNSTILE_PATHS: readonly string[] = ["/login", "/signup", "/reset-password", "/kontakt"];
const LEMON_SQUEEZY_PATHS: readonly string[] = ["/pricing", "/billing", "/plans"];

/** Welche Drittanbieter die Seite unter diesem Pfad einbindet. */
export function thirdPartiesFor(pathname: string): ThirdParties {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return {
    turnstile: TURNSTILE_PATHS.includes(path),
    lemonSqueezy: LEMON_SQUEEZY_PATHS.includes(path),
  };
}

/**
 * Braucht die Seite unter `currentPath` einen Drittanbieter, den die Policy des
 * Dokuments (geladen unter `documentPath`) nicht freigibt? Dann hilft nur ein
 * neues Dokument. Umgekehrt nicht: eine Policy, die mehr erlaubt als die Seite
 * braucht, schadet nicht.
 */
export function needsFreshDocument(documentPath: string, currentPath: string): boolean {
  const allowed = thirdPartiesFor(documentPath);
  const needed = thirdPartiesFor(currentPath);
  return (needed.turnstile && !allowed.turnstile) || (needed.lemonSqueezy && !allowed.lemonSqueezy);
}

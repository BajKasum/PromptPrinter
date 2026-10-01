// Die Pfade der eingeloggten App, an EINER Stelle.
//
// Drei Stellen müssen dieselbe Antwort auf "gehört dieser Pfad zur App?"
// geben: die Middleware (Login-Umleitung), die CSP-Wahl in src/middleware.ts
// (Nonce-Policy nur für die App) und robots.ts (nicht crawlen). Vorher trug
// robots.ts eine eigene Kopie der Liste, und die Middleware kam ganz ohne aus,
// weil sie alles Unbekannte auf /login schickte. Das war für Suchmaschinen
// falsch: eine tote Adresse antwortete mit 307 auf eine Seite mit Status 200,
// nie mit 404.
//
// Dass die Liste vollständig ist, prüft tests/guards/route-access.test.ts
// gegen die Ordner unter src/app/(app). Ein neuer App-Ordner ohne Eintrag hier
// lässt den Test scheitern, statt still nur noch vom (app)-Layout bewacht zu
// werden.
export const APP_PREFIXES = [
  "/chats",
  "/projects",
  "/prompts",
  "/settings",
  "/usage",
  "/billing",
  "/plans",
  // Leitet seit 2026-09-29 per next.config.ts auf /usage um und erreicht die
  // Middleware deshalb nie. Bleibt gelistet, damit robots.txt die alte Adresse
  // weiter ausschliesst.
  "/admin",
] as const;

export function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

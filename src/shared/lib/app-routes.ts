// Die Routenlisten der Zugangsregel, an EINER Stelle: die Pfade der eingeloggten
// App (APP_PREFIXES) und alles, was ein abgemeldeter Besucher erreichen darf
// (PUBLIC_PREFIXES, PUBLIC_EXACT). Wer eine Seite hinzufügt, trägt sie hier ein.
//
// Drei Stellen müssen dieselbe Antwort auf "gehört dieser Pfad zur App?"
// geben: die Middleware (Login-Umleitung), die CSP-Wahl in src/middleware.ts
// (Nonce-Policy nur für die App) und robots.ts (nicht crawlen). Vorher trug
// robots.ts eine eigene Kopie der Liste, und die Middleware kam ganz ohne aus,
// weil sie alles Unbekannte auf /login schickte. Das war für Suchmaschinen
// falsch: eine tote Adresse antwortete mit 307 auf eine Seite mit Status 200,
// nie mit 404.
//
// Dass die Listen vollständig sind, prüft tests/guards/route-access.test.ts
// gegen die Ordner unter src/app. Ein neuer Ordner ohne Eintrag hier lässt den
// Test scheitern, statt still nur noch vom (app)-Layout bewacht zu werden (App)
// oder abgemeldet mit 404 zu antworten (öffentlich).
export const APP_PREFIXES = [
  "/chats",
  "/projects",
  "/prompts",
  "/settings",
  "/usage",
  "/billing",
  "/plans",
  // Bestätigung der Terminal-Anmeldung (api/cli), eingeloggt und ohne Link-Code.
  "/cli",
  // Leitet seit 2026-09-29 per next.config.ts auf /usage um und erreicht die
  // Middleware deshalb nie. Bleibt gelistet, damit robots.txt die alte Adresse
  // weiter ausschliesst.
  "/admin",
] as const;

// Everything a signed-out visitor may reach. Anything not listed needs a
// session (Security-Audit finding M-7).
//
// This used to be the other way round — an allowlist of PROTECTED prefixes —
// which is a hand-maintained duplicate of the route tree, and it had already
// drifted: /prompts was added without being listed, so it was guarded only by
// the (app) layout's own check, one layer later than intended. Inverting the
// default means the failure mode of forgetting an entry flips from "new page is
// unguarded" to "new public page answers 404 while signed out", which is
// visible the first time anyone opens it instead of silent. Only the app's own
// paths (APP_PREFIXES above) redirect to /login; see updateSession in
// server/supabase/middleware.ts.
export const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth", // the OAuth/email callback completes the session, so it can't need one
  // No "/features": next.config.ts redirects it to /#funktionen, and
  // next.config redirects resolve before middleware runs, so the path never
  // reaches this check.
  "/pricing",
  "/skill", // der Skill /pp zum Herunterladen (Seite im Header neben Preise)
  "/docs",
  "/agb",
  "/cookies",
  "/nutzungsrichtlinie",
  "/datenschutz",
  "/impressum",
  "/kontakt",
  "/pro-bald", // Ziel der Pro-Knöpfe, solange Pro nicht kaufbar ist (shared/lib/pro-availability.ts)
  "/rueckerstattung",
  "/ueber",
  "/vergleich",
] as const;

// Metadata routes Next serves from the app directory. Exact matches only, so
// they can't shadow a real page.
export const PUBLIC_EXACT = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  // llms.txt (app/llms.txt/route.ts): without this, an anonymous request —
  // which is every AI crawler and every browser that never logged in — got
  // 307'd to /login instead of the file, silently defeating the whole point.
  "/llms.txt",
] as const;

export function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

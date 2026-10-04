import "server-only";

// Content-Security-Policy for every response (QA finding S-2: chat renders
// third-party markdown via react-markdown, which never emits raw HTML — no
// rehype-raw, no dangerouslySetInnerHTML — so there's no known injection
// path today, but a CSP is the standard second layer of defense regardless.
//
// Trusted origins beyond 'self':
// - challenges.cloudflare.com: Turnstile captcha, loaded as an external
//   <script src> (turnstile-widget.tsx) plus its iframe challenge overlay.
// - lh3.googleusercontent.com / avatars.githubusercontent.com: OAuth avatar
//   images (next.config.ts remotePatterns).
// - the Supabase project origin: the browser client talks to it directly
//   (auth, storage, PostgREST). Every LLM provider call — Z.ai, Gemini,
//   BYOK Anthropic/OpenAI/custom — happens server-side, so none of them
//   need a connect-src entry here.
// - lemonsqueezy.com: Zahlungen. Siehe LEMONSQUEEZY_* unten.
//
// ─── Zwei Varianten, nicht eine (gefunden 05.08.2026) ──────────────────────
// `buildCsp(nonce)` braucht einen PRO-REQUEST-Nonce, den nur `(app)/layout.tsx`
// noch per `headers()` liest und weiterreicht (Planpunkt B-2 hat diesen Aufruf
// aus dem Root-Layout entfernt, um die oeffentlichen Seiten statisch
// auszuliefern — ein `headers()`-Aufruf dort haette wieder den GESAMTEN
// Routenbaum dynamisch gemacht). Auf jeder anderen Route — Landing, `/pricing`,
// `/login`, `/signup`, `/agb`, `/docs/*` — threadet nichts mehr einen Nonce zu
// Next' eigenen Hydration-Scripts durch, middleware.ts setzte aber weiterhin
// unveraendert die STRIKTE, nonce-only-Policy auf JEDE Antwort. Ergebnis: Next'
// eigene `<script>`-Tags (die die serialisierten Server-Component-Daten
// tragen) trugen keinen zur jeweiligen Antwort passenden Nonce mehr, die CSP
// blockierte sie, React hydrierte nie — sichtbar als leere Seite plus
// wiederholtem "Connection closed" von Turnstiles eigenem Skript, dessen
// Kanal nie zustande kam, weil der React-Baum drumherum nie fertig wurde.
//
// `buildStaticCsp()` ist die Antwort fuer genau diese Routen: kein Nonce,
// dafuer `'unsafe-inline'` in `script-src` — vertretbar, weil keine dieser
// Seiten je Drittinhalt oder Nutzer-HTML rendert (das ist ein (app)-only-
// Risiko, siehe oben), und ein Browser ignoriert `'unsafe-inline'` ohnehin
// automatisch, sobald IRGENDEIN Nonce/Hash in derselben Direktive steht — die
// beiden Policies koennen sich also nie gegenseitig aufweichen, weil
// `buildStaticCsp()` niemals einen Nonce-Token enthaelt. Next' eigene
// Doku bestaetigt das als die dokumentierte Grenze: ein Nonce-basiertes CSP
// ist mit statisch generierten Seiten grundsaetzlich nicht vereinbar, weil ein
// Nonce pro Anfrage einzigartig sein muss und eine statische Seite keine
// Anfrage kennt.
//
// middleware.ts entscheidet anhand `isAppPath(pathname)`
// (shared/lib/app-routes.ts, die eine Quelle fuer "ist das eine (app)-Route"),
// welche der beiden hier gilt. Bis 2026-10-01 war das `requiresSession()`,
// das auch jede tote Adresse traf: deren statische 404-Seite bekam die
// Nonce-Policy und hydrierte aus demselben Grund nicht.

// Lemon Squeezy braucht ZWEI Skript-Hosts, nicht einen.
//
// `app.lemonsqueezy.com/js/lemon.js` — die Adresse, die Lemon Squeezy selbst
// ausgibt — antwortet mit `301` auf `assets.lemonsqueezy.com/lemon.js`
// (nachgeprüft am 04.08.2026). Eine CSP prüft bei einer Weiterleitung auch
// das Ziel: stünde hier nur der `app.`-Host, würde das Skript nach der
// Weiterleitung blockiert, und zwar mit einer Meldung, die auf den falschen
// Host zeigt. Beide Einträge gehören also zusammen; wer einen entfernt,
// entfernt den Checkout. Auch auf statischen Seiten noetig: `/pricing` zeigt
// den Pro-Checkout (ProCheckoutCta) einem Besucher, der eingeloggt ist.
const LEMONSQUEEZY_SCRIPT_HOSTS = [
  "https://app.lemonsqueezy.com",
  "https://assets.lemonsqueezy.com",
];

// Das Overlay ist ein <iframe> auf den Checkout des eigenen Stores
// (promptprinter.lemonsqueezy.com). Der Store-Name steckt in der
// Checkout-Adresse und ist damit Konfiguration, keine Konstante — deshalb der
// Platzhalter statt eines festen Hosts. Muss zur Host-Prüfung in
// shared/lib/lemon-squeezy.ts passen: was dort erlaubt ist, muss hier
// einbettbar sein.
const LEMONSQUEEZY_FRAME_HOST = "https://*.lemonsqueezy.com";

// ─── Drittanbieter nur dort, wo eine Seite sie wirklich einbindet ──────────
// (Betriebs-Audit 04.10.2026, Punkt "unsafe-inline auf öffentlichen Seiten")
//
// Die Policy für statische Seiten kommt nicht ohne `'unsafe-inline'` aus (siehe
// oben: Nexts eigene Inline-Skripte tragen keinen Nonce, ein Hash pro Build
// und Seite ist mit statischen Seiten nicht machbar). Das lässt sich nicht
// wegdiskutieren, aber seine Wirkung begrenzen:
//
// 1. Cloudflare Turnstile und Lemon Squeezy standen bisher in JEDER Policy,
//    also auch auf /agb, in der Hilfe und auf der Startseite, die keines von
//    beiden laden. Ein eingeschleustes Skript hätte dort zwei fremde Hosts
//    mehr zum Nachladen gehabt, ohne dass die Seite sie je braucht. Jetzt
//    bekommt eine Route nur, was sie einbindet (`thirdPartiesFor`).
// 2. `script-src-attr 'none'` sperrt Inline-Event-Handler (`onerror=`,
//    `onclick=`): der übliche Weg, eine HTML-Injektion in Code zu verwandeln.
//    `'unsafe-inline'` in `script-src` erlaubt sie sonst mit. React hängt
//    Handler per addEventListener an, lemon.js und Turnstile ebenso (beide
//    geprüft: kein Inline-Handler in ihrem Quelltext). `<script>`-Blöcke bleiben
//    erlaubt, das ist die Grenze, die diese Variante nicht überschreitet.
export type ThirdParties = { turnstile: boolean; lemonSqueezy: boolean };

const NO_THIRD_PARTIES: ThirdParties = { turnstile: false, lemonSqueezy: false };

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

// Exakte Pfade, keine Präfixe: /reset-password/update bindet Turnstile NICHT
// ein (update-password-experience.tsx), /reset-password schon. Dass die Liste
// zu den Seiten passt, hält csp.test.ts gegen den Quelltext fest.
const TURNSTILE_PATHS: readonly string[] = ["/login", "/signup", "/reset-password"];
const LEMON_SQUEEZY_PATHS: readonly string[] = ["/pricing", "/billing", "/plans"];

/** Welche Drittanbieter die Seite unter diesem Pfad einbindet. */
export function thirdPartiesFor(pathname: string): ThirdParties {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return {
    turnstile: TURNSTILE_PATHS.includes(path),
    lemonSqueezy: LEMON_SQUEEZY_PATHS.includes(path),
  };
}

/** Next.js dev mode (webpack, not Turbopack) uses eval() for Fast Refresh's source maps. */
function devEvalSource(): string {
  return process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : "";
}

function supabaseOrigin(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl ? new URL(supabaseUrl).origin : "";
}

/** Alles ausser `script-src`, identisch für beide Varianten. */
function sharedDirectives(scriptSrc: string, parties: ThirdParties): string[] {
  const connectSrc = ["'self'", parties.turnstile ? TURNSTILE_ORIGIN : "", supabaseOrigin()]
    .filter(Boolean)
    .join(" ");
  // Ohne eingebundenen Drittanbieter bleibt `frame-src` nicht leer stehen
  // (eine fehlende Direktive fällt auf default-src zurück, also 'self'),
  // sondern wird ausdrücklich zu 'none'.
  const frameSrc =
    [parties.turnstile ? TURNSTILE_ORIGIN : "", parties.lemonSqueezy ? LEMONSQUEEZY_FRAME_HOST : ""]
      .filter(Boolean)
      .join(" ") || "'none'";
  // M-1 (Audit 06.09.2026): fehlte hier, obwohl `supabaseOrigin()` zwei
  // Zeilen darueber schon fuer connect-src berechnet wird. Jeder hochgeladene
  // Avatar (avatar-upload.tsx laedt ihn oeffentlich in den "avatars"-Bucket)
  // liegt auf genau dieser Origin — ohne den Eintrag blockierte der Browser
  // das eigene Profilbild jedes Nutzers, der eins hochlaedt, live bestaetigt
  // (Konsole: "img-src … violates the following Content Security Policy").
  // Google-/GitHub-Avatare (OAuth) blieben davon unberuehrt, weil die von
  // fremden Hosts kommen, die schon in der Liste stehen — das hat den Fehler
  // beim eigenen Login unsichtbar gemacht.
  const imgSrc = ["'self'", "data:", "https://lh3.googleusercontent.com", "https://avatars.githubusercontent.com", supabaseOrigin()]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Inline-Event-Handler gibt es in dieser App nicht (siehe oben), und sie
    // sind der übliche Weg, eine HTML-Injektion in Code zu verwandeln, auch
    // wo `script-src` selbst `'unsafe-inline'` führt.
    "script-src-attr 'none'",
    // Tailwind/Framer Motion set inline `style` attributes at runtime;
    // limiting this further isn't practical without breaking layout.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
}

/**
 * Für `(app)/*` — dynamisch, `headers()` threadet den Nonce bis zu next-themes durch.
 *
 * `parties` nennt die Drittanbieter, die die Seite einbindet (`thirdPartiesFor`).
 * Ohne Angabe bekommt sie keinen: sicher als Voreinstellung, und eine Seite, die
 * einen braucht, merkt es sofort (der Checkout oder das Captcha laden nicht).
 */
export function buildCsp(nonce: string, parties: ThirdParties = NO_THIRD_PARTIES): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    parties.turnstile ? TURNSTILE_ORIGIN : "",
    ...(parties.lemonSqueezy ? LEMONSQUEEZY_SCRIPT_HOSTS : []),
    devEvalSource(),
  ]
    .filter(Boolean)
    .join(" ");

  return sharedDirectives(scriptSrc, parties).join("; ");
}

/**
 * Für jede Route ausserhalb von `(app)/*` — Marketing, Auth, Legal, Docs.
 *
 * Kein Nonce (siehe Kommentar oben, warum keiner ankäme), dafür
 * `'unsafe-inline'` in `script-src`. Vertretbar hier, weil keine dieser
 * Seiten Nutzer- oder Drittinhalt als HTML rendert. Die Wirkung ist begrenzt
 * durch `script-src-attr 'none'` und dadurch, dass nur die Routen Drittanbieter
 * zugelassen bekommen, die sie einbinden (`thirdPartiesFor`).
 */
export function buildStaticCsp(parties: ThirdParties = NO_THIRD_PARTIES): string {
  const scriptSrc = [
    "'self'",
    parties.turnstile ? TURNSTILE_ORIGIN : "",
    ...(parties.lemonSqueezy ? LEMONSQUEEZY_SCRIPT_HOSTS : []),
    "'unsafe-inline'",
    devEvalSource(),
  ]
    .filter(Boolean)
    .join(" ");

  return sharedDirectives(scriptSrc, parties).join("; ");
}

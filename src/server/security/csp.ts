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
// middleware.ts entscheidet anhand `requiresSession(pathname)` (bereits die
// bestehende, einzige Quelle fuer "ist das eine (app)-Route"), welche der
// beiden hier gilt — keine zweite, separat gepflegte Routenliste.

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

/** Next.js dev mode (webpack, not Turbopack) uses eval() for Fast Refresh's source maps. */
function devEvalSource(): string {
  return process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : "";
}

function supabaseOrigin(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl ? new URL(supabaseUrl).origin : "";
}

/** Alles ausser `script-src`, identisch für beide Varianten. */
function sharedDirectives(scriptSrc: string): string[] {
  const connectSrc = ["'self'", "https://challenges.cloudflare.com", supabaseOrigin()]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind/Framer Motion set inline `style` attributes at runtime;
    // limiting this further isn't practical without breaking layout.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    `frame-src https://challenges.cloudflare.com ${LEMONSQUEEZY_FRAME_HOST}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
}

/** Für `(app)/*` — dynamisch, `headers()` threadet den Nonce bis zu next-themes durch. */
export function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://challenges.cloudflare.com",
    ...LEMONSQUEEZY_SCRIPT_HOSTS,
    devEvalSource(),
  ]
    .filter(Boolean)
    .join(" ");

  return sharedDirectives(scriptSrc).join("; ");
}

/**
 * Für jede Route ausserhalb von `(app)/*` — Marketing, Auth, Legal, Docs.
 *
 * Kein Nonce (siehe Kommentar oben, warum keiner ankäme), dafür
 * `'unsafe-inline'` in `script-src`. Vertretbar hier, weil keine dieser
 * Seiten Nutzer- oder Drittinhalt als HTML rendert.
 */
export function buildStaticCsp(): string {
  const scriptSrc = [
    "'self'",
    "https://challenges.cloudflare.com",
    ...LEMONSQUEEZY_SCRIPT_HOSTS,
    "'unsafe-inline'",
    devEvalSource(),
  ]
    .filter(Boolean)
    .join(" ");

  return sharedDirectives(scriptSrc).join("; ");
}

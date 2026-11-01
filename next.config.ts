import type { NextConfig } from "next";

// Baseline security headers, applied to every response. Content-Security-Policy
// is deliberately NOT here: it needs a per-request nonce (next-themes' anti-flash
// inline script, Next's own hydration scripts), which this static headers()
// config can't produce. See src/middleware.ts + src/server/security/csp.ts instead.
const securityHeaders = [
  // Force HTTPS for two years incl. subdomains. Ignored over plain http (dev),
  // so it only ever hardens production. No `preload` — that's an irreversible
  // external commitment (hstspreload.org); add it deliberately later if wanted.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Nothing here is meant to be framed → block clickjacking outright.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing a response into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin (not the full path) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app never uses, and opt out of Topics.
  //
  // `microphone=(self)` rather than `()`: voice mode (voice-bar.tsx) calls
  // getUserMedia, and an empty allowlist denies the feature to EVERY origin
  // including this one — the promise rejects with NotAllowedError before the
  // browser ever shows a permission prompt, which looks exactly like the user
  // having blocked the mic and can't be recovered from in the UI. `(self)`
  // keeps it available to this origin only; embedded third-party frames still
  // can't reach it, which is what the header was protecting against.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
  },
  // Sever the opener relationship with any cross-origin window, which closes
  // the window-reference side channels (XS-Leaks, and the popup half of
  // tabnabbing) that X-Frame-Options does not cover — that one only handles
  // being framed, not being opened by or opening someone.
  //
  // `same-origin` is safe here specifically because nothing in this app uses a
  // popup: OAuth is a full-page redirect (oauth-buttons.tsx passes `redirectTo`
  // and never skipBrowserRedirect), there is no window.open or postMessage
  // anywhere in src/, and the one target="_blank" (external links inside a
  // chat reply) already carries rel="noreferrer". Turnstile is unaffected —
  // it renders in an iframe, and COOP governs openers, not frames.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Adobe's cross-domain policy files are a legacy surface this app has no use
  // for; the header stops a crossdomain.xml from ever being honoured.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Der Browser-Test-Server (e2e/support/env.ts) läuft im Dev-Modus. Seit Next 16 zählt dessen Dev-Anzeige die
  // React-Meldung zum script-Element von next-themes als Hinweis, klappt links unten auf und deckt das Kontomenü ab:
  // Playwright fände den Knopf nie "stabil". Nur für diesen Server aus, jede andere Entwicklung behält sie.
  devIndicators: process.env.PP_E2E === "1" ? false : undefined,
  // "standalone" is what the Dockerfile's runner stage copies (.next/standalone
  // + server.js, see Dockerfile). Vercel's own build pipeline neither needs nor
  // benefits from it — it always builds its own optimized Function output
  // regardless of this setting — and skipping it there avoids output file
  // tracing having to run at all on that path. `VERCEL` is a system env var
  // Vercel sets on every build (never set locally or in the Docker image), so
  // this is a no-op everywhere except Vercel's own build.
  output: process.env.VERCEL ? undefined : "standalone",
  // Polling nur, wenn WATCHPACK_POLLING gesetzt ist, also im Dev-Container (webpack, siehe Dockerfile): dessen
  // Bind-Mount unter Windows meldet keine Dateiänderungen. Turbopack beachtet die Option nicht.
  watchOptions:
    process.env.WATCHPACK_POLLING === "true" ? { pollIntervalMs: 1000 } : undefined,
  // Bewusst keine `images.remotePatterns`: next/image lädt nur eigene Bilder aus /public/mascot, so verarbeitet
  // der Bildoptimierer (sharp) keine fremden Bytes. Auch die CSP (server/security/csp.ts) kennt keine fremden Bildhosts.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Alte öffentliche Adressen bleiben erreichbar. Diese Umleitungen laufen vor der Middleware, die Auth-Prüfung
  // sieht die Pfade also nicht. /admin ist heute ein Abschnitt von /usage, sichtbar nur für is_admin.
  async redirects() {
    return [
      { source: "/features", destination: "/#funktionen", permanent: true },
      { source: "/admin/:path*", destination: "/usage", permanent: true },
      {
        source: "/vergleich/direkt-im-bau-tool-prompten",
        destination: "/vergleich/direkt-in-die-ki-tippen",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

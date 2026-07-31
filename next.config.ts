import type { NextConfig } from "next";

// Baseline security headers, applied to every response. Content-Security-Policy
// is deliberately NOT here: it needs a per-request nonce (next-themes' anti-flash
// inline script, Next's own hydration scripts), which this static headers()
// config can't produce. See src/middleware.ts + src/lib/csp.ts instead.
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
  // `microphone=(self)` rather than `()`: voice mode (voice-overlay.tsx) calls
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
  output: "standalone",
  // Polling-based file watching, ONLY when WATCHPACK_POLLING is set (the dev
  // Docker container's own compose file sets it, the host's shell/.env.local
  // never does — so this is a no-op everywhere except that one container).
  //
  // The Docker dev container's file watching over its Windows bind mount was
  // broken (a host-side edit never triggered a recompile — a real edit
  // followed by a fresh request kept serving the stale compiled page in
  // ~400ms, no "Compiling ..." log line, where a genuine recompile takes
  // 20-30s+ on this project). Root cause was Turbopack itself: its native
  // watcher (the Rust `notify` crate) never receives filesystem events across
  // that bind mount, and — confirmed by testing this exact option, not
  // assumed — Turbopack does not act on `watchOptions.pollIntervalMs` either,
  // despite it being Next's own documented, bundler-agnostic replacement for
  // WATCHPACK_POLLING/CHOKIDAR_USEPOLLING (which Turbopack also ignores; both
  // only ever appear inside Next's bundled webpack/chokidar, confirmed by
  // searching the compiled package). The actual fix was switching the Docker
  // dev container to webpack (`npm run dev:docker`, see Dockerfile's `dev`
  // stage) — the host's `npm run dev` keeps Turbopack, there's no bind-mount
  // boundary there to work around. `watchOptions` stays set here as
  // defense-in-depth for that webpack path: it's the modern equivalent of the
  // env vars below and costs nothing when unset.
  watchOptions:
    process.env.WATCHPACK_POLLING === "true" ? { pollIntervalMs: 1000 } : undefined,
  // No `images.remotePatterns` on purpose (Security-Audit finding H-2). It used
  // to allowlist the two OAuth avatar hosts, but nothing ever routed a remote
  // URL through next/image: <Mascot> is the only next/image call site and it
  // only ever loads first-party PNGs from /public/mascot, while every avatar
  // (sidebar, settings) renders through a plain <img>. Keeping the patterns
  // meant next/image's optimizer — i.e. sharp, a native libvips binding with a
  // history of CVEs — stayed reachable for third-party bytes for no benefit.
  // Without them, sharp only ever processes our own bundled artwork.
  // The CSP still allows those hosts in img-src (src/lib/csp.ts), which is what
  // the plain <img> tags actually need.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // /features was a page for one day (2026-07-29 → 2026-07-30) before its
  // content moved back into the landing page. Nothing outside this repo should
  // be holding that URL yet — the app isn't hosted — but the route also existed
  // in the sitemap, so this keeps the address answering instead of 404ing, and
  // costs one config entry. next.config redirects run before middleware, so
  // this resolves before the auth check ever sees the path (which is why
  // /features could be dropped from the middleware's public prefixes).
  async redirects() {
    return [{ source: "/features", destination: "/#funktionen", permanent: true }];
  },
};

export default nextConfig;

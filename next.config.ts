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
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
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
};

export default nextConfig;

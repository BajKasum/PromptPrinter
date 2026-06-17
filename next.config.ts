import type { NextConfig } from "next";

// Baseline security headers, applied to every response. Deliberately excludes a
// full Content-Security-Policy: next-themes' anti-flash inline script, Next's
// own inline bootstrap, Stripe and Supabase would all need nonces/allowlisting,
// so a CSP is a separate, larger task. These five are safe to ship as-is.
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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

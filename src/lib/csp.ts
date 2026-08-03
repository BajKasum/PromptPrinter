import "server-only";

// Content-Security-Policy for every response (QA finding S-2: chat renders
// third-party markdown via react-markdown, which never emits raw HTML — no
// rehype-raw, no dangerouslySetInnerHTML — so there's no known injection
// path today, but a CSP is the standard second layer of defense regardless.
// Threaded through a per-request nonce (src/middleware.ts) rather than
// next.config.ts's static headers(), since a nonce can't be static.
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
export function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

  // Next.js dev mode (webpack, not Turbopack) uses eval() for Fast Refresh's
  // source maps — 'unsafe-eval' is required in development or the app never
  // runs, and dropped again for the production bundle it doesn't need.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://challenges.cloudflare.com",
    process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const connectSrc = ["'self'", "https://challenges.cloudflare.com", supabaseOrigin]
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
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

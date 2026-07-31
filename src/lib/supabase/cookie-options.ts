import type { CookieOptions } from "@supabase/ssr";
import { siteUrl } from "@/lib/site-url";

/**
 * Adds the `Secure` flag to Supabase's auth cookies when this app is actually
 * served over https.
 *
 * @supabase/ssr's DEFAULT_COOKIE_OPTIONS sets path, sameSite=lax, httpOnly and
 * maxAge — but never `secure`, so the session cookie is written without it and
 * a browser will happily send it over plaintext http. HSTS (next.config.ts)
 * already forces https for the origin, but only from the second visit onward:
 * it does nothing for the very first request, which is exactly the one that
 * would carry a cookie in the clear.
 *
 * Keyed off the app's own canonical origin rather than NODE_ENV on purpose.
 * `NODE_ENV === "production"` is true for a local `npm run build && npm start`
 * over http://localhost, where a Secure cookie is silently dropped by the
 * browser and login just stops working with no visible reason. Reading it from
 * siteUrl() asks the question that actually matters — "is this deployment
 * https?" — and env.ts already requires NEXT_PUBLIC_APP_URL in production.
 *
 * `httpOnly` is deliberately left at the library's `false`. It is not an
 * oversight: createBrowserClient (lib/supabase/client.ts) reads the session
 * from document.cookie to hydrate the client-side Supabase instance, so an
 * httpOnly session cookie would break every client component that talks to
 * Supabase directly. That is the Supabase SSR cookie model, not a setting.
 */
export function secureCookieOptions(options: CookieOptions): CookieOptions {
  return siteUrl().startsWith("https://") ? { ...options, secure: true } : options;
}

// Canonical base URL for building absolute auth-redirect links (signup confirm,
// password recovery). Prefer the explicit NEXT_PUBLIC_APP_URL so the link is
// deterministic regardless of how the server is reached, under Docker the dev
// server binds to 0.0.0.0, and `window.location.origin` would otherwise bake
// the unreachable `http://0.0.0.0:3000` into the email. Falls back to the live
// browser origin, then a localhost default for SSR without the env var.
export function siteUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const trimmed = base.replace(/\/+$/, "");
  if (!path) return trimmed;
  return `${trimmed}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Validates a `?next=` redirect target (login/signup) is an in-app path
 * before handing it to router.push(), never an attacker-supplied absolute
 * or protocol-relative URL from a crafted link. Mirrors the guard the auth
 * callback route applies server-side (src/app/auth/callback/route.ts), but
 * additionally rejects a leading "//" (a protocol-relative URL still passes
 * a plain `startsWith("/")` check, and unlike the callback route this value
 * is pushed as-is, with no siteUrl() prefix to neutralize it).
 */
export function safeNextPath(raw: string | null, fallback = "/chats/new"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

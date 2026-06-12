// Canonical base URL for building absolute auth-redirect links (signup confirm,
// password recovery). Prefer the explicit NEXT_PUBLIC_APP_URL so the link is
// deterministic regardless of how the server is reached — under Docker the dev
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

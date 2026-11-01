// Canonical base URL for building absolute auth-redirect links (signup confirm,
// password recovery). Prefer the explicit NEXT_PUBLIC_APP_URL so the link is
// deterministic regardless of how the server is reached, under Docker the dev
// server binds to 0.0.0.0, and `window.location.origin` would otherwise bake
// the unreachable `http://0.0.0.0:3000` into the email. Falls back to the live
// browser origin, then a localhost default for SSR without the env var.
export function siteUrl(path = ""): string {
  // `||` und trim, nicht `??`: ein leer gesetztes `NEXT_PUBLIC_APP_URL=` ergab die
  // Basis "", also "/auth/callback" statt einer absoluten Adresse (redirect() wirft
  // darauf, eine Reset-Mail verlinkte ins Leere). Das Literal `process.env.NEXT_PUBLIC_APP_URL`
  // muss stehen bleiben, nur so ersetzt Next es im Client-Bundle.
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const trimmed = base.replace(/\/+$/, "");
  if (!path) return trimmed;
  return `${trimmed}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Validates a `?next=` redirect target (login/signup) is an in-app path
 * before handing it to router.push(), never an attacker-supplied absolute
 * or protocol-relative URL from a crafted link. Also used by the auth
 * callback route (app/auth/callback/route.ts), so there is one check, not
 * two that drift apart. It rejects a leading "//" (a protocol-relative URL
 * still passes a plain `startsWith("/")` check, and the login form pushes the
 * value as-is, with no siteUrl() prefix to neutralize it).
 *
 * Der Browser liest den Wert mit dem URL-Parser, nicht als Text: er streicht Tab und
 * Zeilenumbruch und nimmt den Backslash als Schrägstrich, "/\host" führt also auf einen
 * fremden Host. Deshalb sperrt die Prüfung diese Zeichen und löst danach selbst auf.
 * Zurück geht der Rohwert; die Pfadform "//host" aus "/a/..//host" wird abgelehnt, weil
 * sie als neue Eingabe wieder protokollrelativ wäre.
 */
export function safeNextPath(raw: string | null, fallback = "/chats/new"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  const base = "https://app.invalid";
  try {
    const url = new URL(raw, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
  } catch {
    return fallback;
  }
  return raw;
}

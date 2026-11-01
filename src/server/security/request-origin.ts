import "server-only";

import { bearerToken } from "@/server/supabase/bearer";
import { siteUrl } from "@/shared/lib/site-url";

/**
 * Die eine Schranke gegen untergeschobene Anfragen (CSRF) auf den API-Routen; sie läuft in
 * middleware.ts vor jeder Route. Das Sitzungs-Cookie hat nur `sameSite=lax` aus der Bibliothek, und das
 * hält weder eine Nachbar-Subdomain noch einen Browser auf, der Lax nicht durchsetzt.
 */

/**
 * Routen ohne Cookie, die fremde Aufrufer haben dürfen: Lemon Squeezy prüft seine Signatur selbst, die
 * Geräte-Routen ruft das Terminal mit einem Code oder Token auf. Exakte Pfade, kein Präfix:
 * `/api/cli/approve` nimmt das Cookie und bleibt unter der Schranke.
 */
export const CROSS_ORIGIN_API_ROUTES = [
  "/api/webhooks/lemonsqueezy",
  "/api/cli/device",
  "/api/cli/token",
  "/api/cli/refresh",
  "/api/cli/logout",
] as const;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Sec-Fetch-Site zuerst, denn das setzt der Browser selbst und keine Seite kann es ändern; `same-site`
 * zählt als fremd, genau das ist die Nachbar-Subdomain. Auf reinem http (eigene Installation) fehlt der
 * Kopf, dann entscheidet Origin. Ohne beide ist es kein Browser, also auch keine untergeschobene Anfrage:
 * jeder Browser setzt Origin bei POST, PATCH und DELETE.
 */
function isCrossOriginBrowserRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== new URL(siteUrl()).origin;
  } catch {
    return true; // "null" aus einer Sandbox oder Umleitung
  }
}

/**
 * Muss die Middleware diese Anfrage mit 403 abweisen? Bearer ist ausgenommen: den Kopf kann eine fremde
 * Seite ohne CORS-Freigabe nicht setzen, und wer Bearer sagt, wird nie mit dem Cookie bedient
 * (createClientForRequest).
 */
export function isForbiddenCrossOriginApiCall(request: Request, pathname: string): boolean {
  if (!pathname.startsWith("/api/") || SAFE_METHODS.has(request.method)) return false;
  if ((CROSS_ORIGIN_API_ROUTES as readonly string[]).includes(pathname)) return false;
  if (bearerToken(request) !== null) return false;
  return isCrossOriginBrowserRequest(request);
}

import "server-only";

import { cleanClientName } from "@/server/cli-login/codes";
import { clientIp } from "@/server/security/rate-limit";

// Woher eine Anmeldung per Geräte-Code kommt. Die Bestätigungsseite zeigt es dem Nutzer, damit er eine fremde Anfrage
// erkennt (RFC 8628, Abschnitt 5.4). Der Name des Geräts allein hilft nicht: ihn wählt der Anfragende selbst.

export type RequestContext = { ip: string | null; location: string | null; userAgent: string | null };

const MAX_USER_AGENT_CHARS = 120;

/** Den Kopf setzt Vercel mit URL-Kodierung. Ein kaputter Wert ist kein Ort. */
function decoded(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Stadt und Land stehen nur auf Vercel in vertrauenswürdigen Köpfen: anderswo schickt sie der Aufrufer selbst und könnte
 * dem Nutzer einen beliebigen Ort anzeigen. Nur ungefähr, und ohne Anfrage an einen weiteren Dienst.
 */
function coarseLocation(req: Request): string | null {
  if (!process.env.VERCEL) return null;
  const parts = [req.headers.get("x-vercel-ip-city"), req.headers.get("x-vercel-ip-country")]
    .map(decoded)
    .filter((part): part is string => Boolean(part));
  return cleanClientName(parts.join(", ")) || null;
}

/** Adresse, ungefährer Ort und Programm einer Anfrage, bereinigt wie der Name des Geräts: nichts davon ist geprüft. */
export function requestContext(req: Request): RequestContext {
  const ip = clientIp(req);
  return {
    ip: ip === "unknown" ? null : ip.slice(0, 64),
    location: coarseLocation(req),
    userAgent: cleanClientName(req.headers.get("user-agent") ?? undefined).slice(0, MAX_USER_AGENT_CHARS) || null,
  };
}

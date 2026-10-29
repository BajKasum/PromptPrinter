import "server-only";

import { siteUrl } from "@/shared/lib/site-url";

/**
 * Kommt ein Cookie-POST von der eigenen Seite? Der Browser setzt `Origin` bei jedem POST selbst und
 * lässt es keine Seite fälschen. Gilt nur, wenn der Kopf da ist und genau die eigene Adresse
 * (NEXT_PUBLIC_APP_URL, sonst der lokale Standard) nennt: ein fehlender Kopf oder `null` (Sandbox,
 * umgeleitete Anfrage) zählt als fremd. Zweite Linie neben `sameSite=lax` für die Freigabe der
 * Kommandozeilen-Anmeldung, wo ein untergeschobener Klick ein fremdes Gerät anmeldet.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

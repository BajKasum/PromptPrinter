import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { de, type Messages } from "@/shared/i18n/messages/de";
import { en } from "@/shared/i18n/messages/en";
import { fr } from "@/shared/i18n/messages/fr";
import { it } from "@/shared/i18n/messages/it";
import { DEFAULT_LOCALE, LOCALE_COOKIE, toLocale, type Locale } from "@/shared/i18n/locales";
import { getSessionProfile } from "@/server/session";

// Alle Wörterbücher an einer Stelle, und nur auf dem Server: eine
// Client-Komponente bekommt über den I18nProvider genau das aktive, die
// übrigen Sprachen landen nie im Browser-Bundle.
const CATALOG: Record<Locale, Messages> = {
  de,
  en,
  fr,
  it,
};

export function messagesFor(locale: Locale): Messages {
  return CATALOG[locale];
}

/** Die Sprache aus dem Profil (`profiles.settings.locale`), falls gesetzt. */
export function localeFromSettings(settings: unknown): Locale | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  return toLocale((settings as Record<string, unknown>).locale);
}

/**
 * Die Sprache dieses Requests, für Seiten und Layouts der eingeloggten App.
 *
 * Zuerst der Cookie: ihn setzt die Sprachwahl im Kontomenü, er kostet keine
 * Abfrage. Fehlt er (neues Gerät, gelöschte Cookies), gilt die Sprache aus dem
 * Profil; getSessionProfile() ist pro Request gecacht und läuft im Layout
 * ohnehin. Sonst Deutsch.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const profile = await getSessionProfile();
  return localeFromSettings(profile?.settings) ?? DEFAULT_LOCALE;
});

/** Das Wörterbuch dieses Requests, für Server-Komponenten. */
export async function getT(): Promise<Messages> {
  return messagesFor(await getLocale());
}

/**
 * Für API-Routen: die Sprache aus dem Cookie-Header genau dieses Requests.
 *
 * Nur der Cookie, keine Profil-Abfrage auf dem heissen Pfad (siehe
 * server/session.ts, warum die API-Routen den Request-Cache bewusst nicht
 * nutzen). Er fehlt höchstens auf einem neuen Gerät bis zum ersten
 * Seitenaufruf, dann schreibt ihn der I18nProvider nach.
 *
 * Aus dem Request gelesen statt über next/headers: die Routen-Tests rufen
 * POST(req) direkt auf, ausserhalb eines Next-Request-Kontexts, in dem
 * cookies() wirft.
 */
export function requestT(req: Request): { locale: Locale; t: Messages } {
  const value = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  const locale = toLocale(value) ?? DEFAULT_LOCALE;
  return { locale, t: messagesFor(locale) };
}

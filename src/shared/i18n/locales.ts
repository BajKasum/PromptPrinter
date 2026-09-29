// Die Sprachen der eingeloggten App (Entscheid 29.09.2026). Die Landing Page,
// Login/Registrierung und die Rechtstexte bleiben bewusst Deutsch: eine
// übersetzte Datenschutzerklärung wäre rechtlich eine eigene Fassung.
//
// Eine neue Sprache kommt so dazu: Code hier in LOCALES, Eigenname und Tags
// darunter, ein Wörterbuch unter messages/<code>.ts, eingetragen in
// server/i18n.ts. TypeScript meldet jeden fehlenden Schlüssel, weil jedes
// Wörterbuch den Typ `Messages` aus de.ts erfüllen muss.

export const LOCALES = ["de", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Cookie mit der gewählten Sprache (siehe cookie-inventory.ts). */
export const LOCALE_COOKIE = "pp-locale";

/** So nennt sich jede Sprache selbst, damit man sie auch findet, wenn man die aktuelle nicht liest. */
export const LOCALE_NAMES: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};

/**
 * - `intl`: für Datum, Zahlen und Mehrzahl (Intl.*). Deutsch als de-CH,
 *   das Produkt kommt aus Basel und schreibt auch sonst Schweizer Deutsch.
 * - `speech`: für die Spracherkennung im Sprachmodus (Web Speech API).
 */
export const LOCALE_TAGS: Record<Locale, { intl: string; speech: string }> = {
  de: { intl: "de-CH", speech: "de-DE" },
  // Britisch: Datum als "29 Sept 2026" statt "Sep 29, 2026", näher an der
  // europäischen Reihenfolge, in der der Rest der App denkt.
  en: { intl: "en-GB", speech: "en-US" },
};

/**
 * Englischer Name der Sprache, für Anweisungen an ein Modell ("Write the
 * values in German"). Die Projekt-Analyse schreibt so in der Sprache der
 * Oberfläche statt in der der Quellen (Audit 23.09.2026, F-7).
 */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  de: "German",
  en: "English",
};

export function toLocale(raw: unknown): Locale | null {
  return typeof raw === "string" && (LOCALES as readonly string[]).includes(raw)
    ? (raw as Locale)
    : null;
}

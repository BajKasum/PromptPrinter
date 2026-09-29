// Die Sprachen der eingeloggten App (Entscheid 29.09.2026). Die Landing Page,
// Login/Registrierung und die Rechtstexte bleiben bewusst Deutsch: eine
// übersetzte Datenschutzerklärung wäre rechtlich eine eigene Fassung.
//
// Eine neue Sprache kommt so dazu: Code hier in LOCALES, Eigenname und Tags
// darunter, ein Wörterbuch unter messages/<code>.ts, eingetragen in
// server/i18n.ts. TypeScript meldet jeden fehlenden Schlüssel, weil jedes
// Wörterbuch den Typ `Messages` aus de.ts erfüllen muss.

export const LOCALES = ["de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Cookie mit der gewählten Sprache (siehe cookie-inventory.ts). */
export const LOCALE_COOKIE = "pp-locale";

/** So nennt sich jede Sprache selbst, damit man sie auch findet, wenn man die aktuelle nicht liest. */
export const LOCALE_NAMES: Record<Locale, string> = {
  de: "Deutsch",
};

/**
 * - `intl`: für Datum, Zahlen und Mehrzahl (Intl.*). Deutsch als de-CH,
 *   das Produkt kommt aus Basel und schreibt auch sonst Schweizer Deutsch.
 * - `speech`: für die Spracherkennung im Sprachmodus (Web Speech API).
 */
export const LOCALE_TAGS: Record<Locale, { intl: string; speech: string }> = {
  de: { intl: "de-CH", speech: "de-DE" },
};

/**
 * Englischer Name der Sprache, für Anweisungen an ein Modell ("Write the
 * values in German"). Die Projekt-Analyse schreibt so in der Sprache der
 * Oberfläche statt in der der Quellen (Audit 23.09.2026, F-7).
 */
export const LOCALE_ENGLISH_NAMES: Record<Locale, string> = {
  de: "German",
};

export function toLocale(raw: unknown): Locale | null {
  return typeof raw === "string" && (LOCALES as readonly string[]).includes(raw)
    ? (raw as Locale)
    : null;
}

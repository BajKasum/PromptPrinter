/**
 * Zentrale Betreiber- und Rechtsangaben für Impressum, Datenschutz und AGB.
 *
 * VOR DEM LAUNCH: alle [PLATZHALTER] durch echte Angaben ersetzen. Diese
 * Vorlagen sind ein solider Startpunkt, ersetzen aber keine Rechtsberatung —
 * vor einem öffentlichen Launch mit echten Nutzern juristisch prüfen lassen.
 */
export const LEGAL = {
  /** Vollständiger Name oder Firma des Betreibers. */
  operator: "[VOLLSTÄNDIGER NAME / FIRMA]",
  street: "[STRASSE NR.]",
  postalCity: "[PLZ ORT]",
  country: "Schweiz",
  /** Kontakt-E-Mail für Nutzer- und Datenschutzanfragen. */
  email: "kasumbajrami7@gmail.com",
  /** Optional: Handelsregister-/UID-Nummer. Leer lassen ⇒ Zeile entfällt. */
  companyId: "",
  /** Region, in der Supabase die Daten speichert, z. B. "EU (Frankfurt)". */
  dataRegion: "EU (Irland)",
  /** Anbieter, der die App hostet, z. B. "Vercel Inc., USA". */
  appHost: "[HOSTING-ANBIETER, z. B. Vercel Inc., USA]",
  /** Gerichtsstand für die AGB, z. B. "Zürich". */
  jurisdiction: "[GERICHTSSTAND, z. B. Zürich]",
  /** Letzte Aktualisierung der Rechtstexte. */
  lastUpdated: "4. Juni 2026",
} as const;

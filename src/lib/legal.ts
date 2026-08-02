/**
 * Zentrale Betreiber- und Rechtsangaben für Impressum, Datenschutz und AGB.
 *
 * Es stehen keine Platzhalter mehr drin. Falls je wieder einer dazukommt:
 * diese Werte werden IN DEN RECHTSTEXTEN GERENDERT, ein `[PLATZHALTER]` steht
 * also wörtlich auf einer öffentlichen Seite und macht die Angabe rechtlich
 * wertlos, statt nur unschön auszusehen. Genau das war bis 2026-08-02 mit
 * `appHost` der Fall, an zwei Stellen der Datenschutzerklärung.
 *
 * Diese Vorlagen sind ein solider Startpunkt, ersetzen aber keine
 * Rechtsberatung — vor einem Launch mit zahlenden Kunden juristisch prüfen
 * lassen.
 */
export const LEGAL = {
  /** Vollständiger Name oder Firma des Betreibers. */
  operator: "Kasum Bajrami",
  street: "Riehenstrasse 80",
  postalCity: "4058 Basel",
  country: "Schweiz",
  /** Kontakt-E-Mail für Nutzer- und Datenschutzanfragen. */
  email: "kasumbajrami7@gmail.com",
  /** Optional: Handelsregister-/UID-Nummer. Leer lassen ⇒ Zeile entfällt. */
  companyId: "",
  /**
   * Region, in der Supabase die Daten speichert. Gegen das echte Projekt
   * geprüft (2026-08-02): `region: "eu-west-1"`, also AWS Irland.
   */
  dataRegion: "EU (Irland)",
  /** Anbieter, der die App hostet. Deployment: promptprinter.vercel.app. */
  appHost: "Vercel Inc., USA",
  /** Gerichtsstand für die AGB, z. B. "Zürich". */
  jurisdiction: "Basel-Stadt",
  /** Letzte Aktualisierung der Rechtstexte (gilt für alle vier gemeinsam). */
  lastUpdated: "2. August 2026",
} as const;

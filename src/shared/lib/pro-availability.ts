// Schalter: ist der Pro-Plan kaufbar?
//
// `false` seit 2026-10-17 (Kasum): Vercel Hobby erlaubt laut Fair-Use-Regeln keine
// Zahlungen (nur nicht-kommerzielle Nutzung), der Pro-Plan von Vercel (rund 20 $ im
// Monat) ist noch nicht gebucht. Solange der Schalter aus ist, führt JEDER Pro-Knopf
// (Preisseite, /plans, /billing) auf PRO_UNAVAILABLE_PATH, eine Entschuldigung statt
// des Bezahlfensters. Alles andere bleibt unverändert im Code: Checkout-Seite, Webhook,
// Kundenportal, Preise. Nichts ist gelöscht, nur der Weg dorthin ist zu.
//
// Wieder einschalten: docs/PRO-WIEDERAUFNAHME.md (Voraussetzungen und Schritte).
// Ein Guard (tests/guards/pro-availability.test.ts) hält Schalter, Seite und Anleitung
// beisammen.
export const PRO_AVAILABLE = false;

/** Wohin jeder Pro-Knopf führt, solange PRO_AVAILABLE aus ist. Öffentliche Seite. */
export const PRO_UNAVAILABLE_PATH = "/pro-bald";

/**
 * Alles, was PromptPrinter selbst im Browser speichert. Quelle für die Seite
 * /cookies und für den Guard `tests/guards/cookie-inventory.test.ts`, der
 * scheitert, sobald der Code ein Cookie oder einen localStorage-Schlüssel
 * schreibt, der hier nicht steht.
 *
 * Der Guard ist der Grund, warum das eine Datei ist und kein Fliesstext in der
 * Seite: eine Cookie-Richtlinie, die ein neues Cookie verschweigt, ist nach
 * Art. 45c FMG eine unvollständige Information, und das fällt niemandem auf,
 * bis es jemand im Browser nachzählt.
 *
 * Stand 28.09.2026, gegen den Code und die Live-Seite geprüft: öffentliche
 * Seiten setzen für nicht angemeldete Besucher gar nichts (auch kein
 * localStorage), die Einträge unten entstehen erst in der App bzw. beim
 * Anmelden.
 */
export type StorageEntry = {
  /** Name, wie ihn der Browser in den Entwicklerwerkzeugen zeigt. */
  name: string;
  kind: "Cookie" | "Lokaler Speicher (localStorage)";
  /** Wer den Eintrag setzt. */
  setBy: string;
  purpose: string;
  /** Wann der Eintrag überhaupt entsteht. */
  when: string;
  duration: string;
};

export const FIRST_PARTY_STORAGE: StorageEntry[] = [
  {
    // Name kommt von @supabase/ssr: `sb-<Projekt-Referenz>-auth-token`, bei
    // grossen Sitzungen in `.0`, `.1` … aufgeteilt. maxAge ist der
    // Bibliotheks-Standard (400 Tage), siehe server/supabase/cookie-options.ts.
    name: "sb-…-auth-token",
    kind: "Cookie",
    setBy: "PromptPrinter, über unseren Anmeldedienst Supabase",
    purpose:
      "Hält deine Anmeldung aufrecht. Ohne dieses Cookie wüsste die App bei jedem Klick nicht mehr, wer du bist.",
    when: "Nach dem Anmelden.",
    duration:
      "Bis du dich abmeldest, höchstens 400 Tage. Bei grossen Sitzungen wird es in mehrere Teile mit der Endung .0, .1 usw. aufgeteilt.",
  },
  {
    // PKCE: supabase-js legt `${storageKey}-code-verifier` an und entfernt es
    // beim Code-Tausch in /auth/callback wieder.
    name: "sb-…-auth-token-code-verifier",
    kind: "Cookie",
    setBy: "PromptPrinter, über unseren Anmeldedienst Supabase",
    purpose:
      "Ein Sicherheitswert, der verhindert, dass ein abgefangener Anmelde- oder Bestätigungslink von jemand anderem benutzt werden kann.",
    when: "Während einer Anmeldung über Google oder GitHub und bei Links aus unseren E-Mails, etwa zum Bestätigen des Kontos oder Zurücksetzen des Passworts.",
    duration: "Wird gelöscht, sobald die Anmeldung abgeschlossen ist.",
  },
  {
    name: "pp-sidebar",
    kind: "Cookie",
    setBy: "PromptPrinter",
    purpose:
      "Merkt sich, ob du die Seitenleiste ein- oder ausgeklappt hast. Enthält nur die Ziffer 0 oder 1.",
    when: "Erst wenn du in der App die Seitenleiste ein- oder ausklappst.",
    duration: "1 Jahr.",
  },
  {
    name: "pp-sidebar-width",
    kind: "Cookie",
    setBy: "PromptPrinter",
    purpose: "Merkt sich, wie breit du die Seitenleiste gezogen hast. Enthält nur eine Pixelzahl.",
    when: "Erst wenn du in der App die Breite der Seitenleiste veränderst.",
    duration: "1 Jahr.",
  },
  {
    // shared/i18n/locales.ts (LOCALE_COOKIE). Gesetzt von der Sprachwahl
    // (use-change-locale.ts) und, auf einem neuen Gerät, vom I18nProvider,
    // wenn die Sprache aus dem Profil kam.
    name: "pp-locale",
    kind: "Cookie",
    setBy: "PromptPrinter",
    purpose:
      "Merkt sich die Sprache, die du für die App gewählt hast. Enthält nur ein Sprachkürzel wie de oder en.",
    when: "Erst wenn du in der App eine Sprache wählst, oder beim ersten Aufruf auf einem neuen Gerät, wenn in deinem Konto schon eine gespeichert ist.",
    duration: "1 Jahr.",
  },
  {
    // next-themes' Standard-storageKey, (app)/layout.tsx setzt keinen eigenen.
    name: "theme",
    kind: "Lokaler Speicher (localStorage)",
    setBy: "PromptPrinter",
    purpose:
      "Merkt sich, ob die App hell, dunkel oder passend zu deinem System erscheinen soll. Wird nie an uns übertragen.",
    when: "Erst wenn du in der App ein Farbschema wählst.",
    duration: "Bis du ihn in deinem Browser löschst.",
  },
];

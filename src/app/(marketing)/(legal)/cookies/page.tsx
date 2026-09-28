import { Fragment } from "react";
import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";
import { FIRST_PARTY_STORAGE } from "@/features/marketing/lib/cookie-inventory";
import { LEGAL } from "@/shared/lib/legal";

export const metadata: Metadata = {
  title: "Cookies",
  description:
    "Welche Cookies und Browser-Speicher PromptPrinter verwendet, wofür und wie lange, und warum es kein Cookie-Banner gibt.",
  alternates: { canonical: "/cookies" },
};

// Die einzelnen Einträge kommen aus cookie-inventory.ts, nicht aus dieser
// Datei: ein Guard (tests/guards/cookie-inventory.test.ts) prüft dort, dass
// jedes Cookie, das der Code schreibt, auch hier erscheint.
export default function CookiesPage() {
  return (
    <LegalShell
      badge="Rechtliches"
      title="Cookie-Richtlinie"
      intro="Kurz: nur technisch notwendige Cookies, kein Tracking, keine Werbung. Deshalb gibt es auch kein Cookie-Banner."
      updated={LEGAL.lastUpdated}
    >
      <h2>1. Das Wichtigste</h2>
      <p>
        Wir setzen ausschliesslich Cookies und Browser-Speicher ein, die für den Betrieb von
        PromptPrinter technisch notwendig sind: damit du angemeldet bleibst, damit deine
        Einstellungen an der Oberfläche erhalten bleiben und damit die Anmeldeformulare vor
        automatisierten Zugriffen geschützt sind. Es gibt{" "}
        <strong>keine Analyse-, Tracking- oder Werbe-Cookies</strong>, und wir binden keine
        Drittanbieter zu solchen Zwecken ein.
      </p>
      <p>
        Wer nur die öffentlichen Seiten besucht, also Startseite, Preise, Hilfe und Rechtstexte,
        bekommt von uns nichts im Browser gespeichert. Die Einträge unten entstehen erst beim
        Anmelden oder in der App selbst.
      </p>

      <h2>2. Was wir im Browser speichern</h2>
      {FIRST_PARTY_STORAGE.map((entry) => (
        <Fragment key={entry.name}>
          <h3>
            <code>{entry.name}</code>
          </h3>
          <ul>
            <li>
              <strong>Art:</strong> {entry.kind}, gesetzt von {entry.setBy}
            </li>
            <li>
              <strong>Zweck:</strong> {entry.purpose}
            </li>
            <li>
              <strong>Wann:</strong> {entry.when}
            </li>
            <li>
              <strong>Speicherdauer:</strong> {entry.duration}
            </li>
          </ul>
        </Fragment>
      ))}

      <h2>3. Dienste von Drittanbietern</h2>
      <h3>Cloudflare Turnstile (Schutz vor Bots)</h3>
      <p>
        Auf den Formularen für Anmeldung, Registrierung und Passwort-Zurücksetzen prüft das Captcha
        „Turnstile“ von Cloudflare, ob ein Mensch oder ein Programm das Formular abschickt. Dazu lädt
        dein Browser ein Skript von Cloudflare, das kurzzeitig technische Merkmale deines Browsers
        auswertet. Cookies setzt Turnstile dabei nach Angaben von Cloudflare in der
        Standardeinstellung nicht. Der Zweck ist ausschliesslich die Sicherheit der Anmeldung.
      </p>
      <h3>Lemon Squeezy (Bezahlung)</h3>
      <p>
        Wenn du angemeldet die Preisseite oder die Abrechnungsseite öffnest, lädt dein Browser ein
        Skript von Lemon Squeezy, damit sich das Bezahlfenster öffnen lässt. Dieses Skript setzt
        selbst keine Cookies. Öffnest du das Bezahlfenster, können Lemon Squeezy und die dort
        eingebundenen Zahlungsanbieter eigene Cookies setzen, etwa zur Betrugsprävention. Dafür ist
        Lemon Squeezy als Verkäufer selbst verantwortlich, siehe die{" "}
        <a href="https://www.lemonsqueezy.com/privacy" rel="noopener noreferrer" target="_blank">
          Datenschutzerklärung von Lemon Squeezy
        </a>
        .
      </p>

      <h2>4. Warum es kein Cookie-Banner gibt</h2>
      <p>
        Für Cookies, ohne die ein von dir ausdrücklich gewünschter Dienst nicht funktioniert, braucht
        es weder nach Schweizer Recht noch nach dem Recht der EU eine Einwilligung. Das Schweizer
        Fernmeldegesetz (Art. 45c) verlangt, dass wir dich über diese Speicherung und ihren Zweck
        informieren und dir sagen, wie du sie ablehnen kannst. Genau dafür ist diese Seite da. Sollten
        wir je Cookies einsetzen wollen, die nicht technisch notwendig sind, fragen wir dich vorher
        um Erlaubnis.
      </p>

      <h2>5. So lehnst du Cookies ab oder löschst sie</h2>
      <p>
        Du kannst Cookies und den lokalen Speicher jederzeit in den Einstellungen deines Browsers
        blockieren oder löschen. Beachte: Ohne die Anmelde-Cookies ist keine Anmeldung möglich, und
        ohne die gespeicherten Einstellungen startet die Oberfläche jeweils in der Standardansicht.
        Wenn du dich abmeldest, entfernen wir die Anmelde-Cookies selbst.
      </p>

      <h2>6. Mehr dazu</h2>
      <p>
        Wie wir Personendaten insgesamt bearbeiten, steht in der{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>. Fragen beantworten wir unter{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalShell>
  );
}

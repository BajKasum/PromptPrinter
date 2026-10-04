import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";
import { LEGAL } from "@/shared/lib/legal";
import { pageMetadata } from "@/shared/lib/page-metadata";

const doc = docBySlug("konto-und-daten")!;

export const metadata: Metadata = pageMetadata({
  title: doc.title,
  description: doc.summary,
  path: docHref(doc.slug),
});

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Konto und Daten"
      intro="Anmeldung, Profil, und die ehrliche Antwort darauf, was gespeichert wird und wie du alles wieder loswirst."
    >
      <h2>Wie melde ich mich an?</h2>
      <p>
        Du kannst dich mit E-Mail und Passwort anmelden oder über Google oder
        GitHub. Wenn du dich einmal über einen dieser Dienste angemeldet hast,
        bleib am besten dabei, so landest du zuverlässig im selben Konto.
      </p>

      <h2>Wie ändere ich mein Passwort oder setze es zurück?</h2>
      <p>
        Auf der Anmeldeseite gibt es den Weg über{" "}
        <Link href="/reset-password">Passwort zurücksetzen</Link>, du bekommst
        dann einen Link per E-Mail. Bist du bereits angemeldet, änderst du das
        Passwort direkt unter <strong>Einstellungen</strong>. Mindestlänge sind
        acht Zeichen.
      </p>

      <h2>Was kann ich im Profil einstellen?</h2>
      <p>
        In den Einstellungen kannst du deinen Anzeigenamen setzen. Er ist auch
        das, womit Finn dich im leeren Chat begrüsst. Ohne Angabe wird der Teil
        vor dem @ deiner E-Mail-Adresse benutzt.
      </p>
      <p>
        Ausserdem stellst du dort das Erscheinungsbild ein, hell, dunkel oder
        nach Systemeinstellung.
      </p>

      <h2>Welche Daten speichert PromptPrinter?</h2>
      <ul>
        <li>dein Konto: E-Mail, Anzeigename</li>
        <li>
          deine Chats vollständig, also deine Nachrichten und Finns Antworten
        </li>
        <li>deine Projekte samt Anweisungen, Struktur und gespeicherten Prompts</li>
        <li>
          hochgeladene <Link href="/docs/dateien">Dateien</Link> und{" "}
          <Link href="/docs/chat-mit-finn">Anhänge deiner Chats</Link> in einem
          privaten Speicher
        </li>
        <li>
          falls hinterlegt, dein{" "}
          <Link href="/docs/eigene-api-keys">API-Key</Link>, verschlüsselt
        </li>
      </ul>
      <p>
        Die Daten liegen bei Supabase in der Region {LEGAL.dataRegion}. Für die
        Antworten selbst wird dein Text an den Modellanbieter übermittelt, wer
        das genau ist und was das bedeutet, steht in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>Wer kann auf meine Daten zugreifen?</h2>
      <p>
        Deine Chats und Projekte sind auf dein Konto beschränkt, durchgesetzt auf
        Datenbankebene, nicht bloss in der Oberfläche. Es gibt aktuell keine
        Freigabe- oder Teilen-Funktion, deine Inhalte sind für niemanden sonst
        sichtbar.
      </p>

      <h2>Kann ich meine Daten herunterladen?</h2>
      <p>
        Ja, unter <strong>Einstellungen</strong> in der Karte{" "}
        <strong>Deine Daten</strong> mit einem Klick auf{" "}
        <strong>Daten herunterladen</strong>. Du bekommst eine JSON-Datei mit
        deinem Konto, deinen Projekten samt Gedächtnis, deinen Chats mit allen
        Nachrichten, deinen gespeicherten Prompts und den Einstellungen.
      </p>
      <p>
        Nicht dabei sind deine API-Keys, weder im Klartext noch verschlüsselt:
        die Datei darf gefahrlos in einer Mail landen. Hochgeladene Dateien und
        Chat-Bilder stehen nur mit Name, Typ und Größe darin, nicht mit ihrem
        Inhalt; die Originale hast du ohnehin selbst. Pro Stunde sind es
        höchstens fünf Downloads.
      </p>

      <h2>Wie lösche ich mein Konto?</h2>
      <p>
        Unter <strong>Einstellungen</strong> ganz unten kannst du dein Konto
        selbst löschen. Dabei werden dein Konto, deine Chats, deine Projekte,
        gespeicherte Prompts, hochgeladene Dateien, Chat-Anhänge und ein
        hinterlegter API-Key entfernt, auch die Dateien im Speicher, nicht nur
        ihre Datenbankeinträge.
      </p>
      <p>
        Das ist endgültig und lässt sich nicht rückgängig machen. Wenn du etwas
        behalten willst, lade vorher deine Daten herunter (siehe oben), jede
        einzelne Antwort lässt sich außerdem als Markdown herunterladen.
      </p>

      <h2>An wen wende ich mich bei Fragen zu meinen Daten?</h2>
      <p>
        Auskunft, Berichtigung, Löschung: schreib einfach an{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, oder nutz die{" "}
        <Link href="/kontakt">Kontaktseite</Link>.
      </p>
    </DocsShell>
  );
}

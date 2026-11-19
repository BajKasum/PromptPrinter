import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import { FREE_TRIAL, PLAN_LIMITS } from "@/shared/lib/plans";
import { docMetadata } from "@/features/marketing/lib/article-metadata";

const doc = docBySlug("plaene-und-limits")!;

export const metadata: Metadata = docMetadata(doc);

// Die Zahlen kommen aus demselben Modul, mit dem der Server sie durchsetzt, damit die Seite nicht still von den
// echten Grenzen abweicht. Die Adresse /docs/plaene-und-limits bleibt, auch wenn es nur noch einen Plan gibt:
// Hilfe, Vergleiche und Kontaktseite verlinken sie.
const free = PLAN_LIMITS.free;

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Pläne und Limits"
      intro="PromptPrinter kostet nichts. Ein paar Grenzen gibt es trotzdem, hier steht, welche und warum."
    >
      <h2>Was kostet PromptPrinter?</h2>
      <p>
        Nichts. Es gibt keinen bezahlten Plan, PromptPrinter ist{" "}
        <Link href="/open-source">kostenlos und Open Source</Link>. Die{" "}
        <strong>ersten drei Prompts gehen auf mich</strong>, ganz ohne Key.
        Danach brauchst du einen{" "}
        <Link href="/docs/eigene-api-keys">eigenen API-Key</Link> (Anthropic,
        OpenAI, Gemini oder ein anderer OpenAI-kompatibler Anbieter), dann läuft
        alles über deinen eigenen Zugang. Wie du einen kostenlosen Gemini-Key
        bekommst, steht unter{" "}
        <Link href="/docs/eigene-api-keys">Eigene API-Keys</Link>.
      </p>
      <ul>
        <li>
          <strong>{free.projects} Projekte</strong>
        </li>
        <li>
          <strong>{FREE_TRIAL.prompts} Prompts gratis</strong>, danach{" "}
          <strong>eigener API-Key</strong>, mit ihm kein Nachrichtenlimit
        </li>
        <li>Kopieren, Markdown- und PDF-Export</li>
      </ul>

      <h2>Wie werden die Gratis-Prompts gezählt?</h2>
      <p>
        Gezählt wird der <strong>fertige Prompt</strong>, nicht meine Rückfrage
        davor und nicht deine Nachricht. Die drei gelten einmal je Konto, nicht
        je Monat. Damit niemand mit Rückfragen allein den Rahmen dehnt, endet er
        auch nach {FREE_TRIAL.turns} Antworten von mir, selbst wenn noch kein
        dritter Prompt dabei war. Ein gescheiterter Versuch zählt nicht.
      </p>
      <p>
        Weil sich Konten ohne Bestätigung anlegen lassen, ist der Gratis-Rahmen
        zusätzlich je Anschluss und Tag begrenzt. Ist er an einem Tag
        ausgeschöpft, geht es am nächsten weiter, mit eigenem Key sofort.
      </p>
      <p>
        Die Gratis-Prompts laufen über meinen Modellzugang bei{" "}
        <strong>Z.ai in Singapur</strong>. Vor dem ersten frage ich dich deshalb
        einmal, ob du damit einverstanden bist, dass deine Nachrichten dorthin
        gehen. Du kannst das in den Einstellungen widerrufen, dann antworte ich
        nur noch mit deinem eigenen Key. Die Einzelheiten stehen in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>Was gilt mit eigenem Key?</h2>
      <p>
        Hinterlegst du einen{" "}
        <Link href="/docs/eigene-api-keys">eigenen API-Key</Link>, gibt es kein
        Nachrichtenlimit. Du zahlst die Modellnutzung direkt bei deinem
        Anbieter. Nach den drei Gratis-Prompts ist das kein Bonus, sondern die
        Voraussetzung für weitere Chats.
      </p>
      <p>
        Die Analyse eines Projekts (das{" "}
        <Link href="/docs/projekte">Gedächtnis</Link> einmal einlesen) läuft nur
        mit eigenem Key, die Gratis-Prompts gelten für den Chat.
      </p>

      <h2>Wie viele Projekte kann ich anlegen?</h2>
      <p>
        Bis zu {free.projects} gleichzeitig. Löschst du eins, ist wieder Platz
        für ein neues. Chats ohne Projekt zählen nicht mit.
      </p>

      <h2>Was zählt gar nicht?</h2>
      <ul>
        <li>
          <Link href="/docs/ergebnisse">Prompts speichern</Link>, dabei wird kein
          Modell aufgerufen
        </li>
        <li>Kopieren, Markdown- und PDF-Export</li>
        <li>Projekte anlegen, Dateien hochladen, Chats umbenennen</li>
      </ul>

      <h2>Gibt es ein Limit pro Stunde?</h2>
      <p>
        Ja, eine stündliche Obergrenze, auch mit eigenem Key. Die ist kein
        Sparmodell, sondern verhindert, dass ein Skript oder ein Fehler den
        Dienst für alle lahmlegt. Im normalen Arbeiten wirst du sie nicht
        bemerken. Läufst du doch hinein, bekommst du eine deutliche Meldung und
        kannst es kurz darauf wieder versuchen.
      </p>

      <h2>Was passiert, wenn ein Limit erreicht ist?</h2>
      <p>
        Du bekommst eine klare Meldung, die sagt, welches Limit es war und was du
        tun kannst. Nichts geht dabei verloren, deine Chats und Projekte bleiben
        vollständig erhalten und lesbar.
      </p>

      <h2>Und wenn ich PromptPrinter selbst betreibe?</h2>
      <p>
        Dann gibt es keine Gratis-Prompts und keinen Zwang zum eigenen Key: jedes
        Konto chattet über dein eigenes Modell. Wie das geht, steht auf{" "}
        <Link href="/open-source">Kostenlos und Open Source</Link>.
      </p>
    </DocsShell>
  );
}

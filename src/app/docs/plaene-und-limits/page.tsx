import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/lib/docs-nav";
import { PLAN_LIMITS } from "@/lib/plans";

const doc = docBySlug("plaene-und-limits")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

// Numbers come from the same module the server enforces them with, so this
// page can't quietly drift away from the real limits.
const free = PLAN_LIMITS.free;
const pro = PLAN_LIMITS.pro;

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Pläne und Limits"
      intro="Zwei Pläne, zwei Grenzen, die wirklich zählen. Hier steht, was gemessen wird und was nicht."
    >
      <h2>Free</h2>
      <p>
        Free hat <strong>keinen eigenen Zugang zu meinem Modell</strong>. Du
        brauchst zwingend einen{" "}
        <Link href="/docs/eigene-api-keys">eigenen API-Key</Link>{" "}
        (Anthropic, OpenAI oder Gemini), um mit mir zu chatten, dafür läuft
        dann alles über deinen eigenen Zugang und kostet mich nichts, also
        dich auch nichts extra.
      </p>
      <ul>
        <li>
          <strong>{free.projects} Projekte</strong>
        </li>
        <li>
          <strong>Eigener API-Key erforderlich</strong>, mit ihm kein
          Nachrichtenlimit
        </li>
        <li>Kopieren und Markdown-Export</li>
      </ul>

      <h2>Pro</h2>
      <p>
        Pro läuft <strong>ohne eigenen Key</strong>, ich stelle meinen
        Modellzugang bereit.
      </p>
      <ul>
        <li>
          <strong>Unbegrenzt Projekte</strong>
        </li>
        <li>
          <strong>{pro.chatMessages} Chat-Antworten pro Monat</strong> über
          meinen Modellzugang
        </li>
        <li>Zusätzlich PDF-Export</li>
        <li>Kein eigener API-Key nötig</li>
      </ul>
      <p>
        Die aktuellen Preise stehen auf der{" "}
        <Link href="/pricing">Preisseite</Link>.
      </p>

      <h2>Was genau gezählt wird</h2>
      <p>
        Gezählt wird <strong>eine Antwort von Finn</strong>, nicht deine eigene
        Nachricht und nicht das Gespräch als Ganzes. Ein Chat mit fünf Hin und
        Her verbraucht also fünf.
      </p>
      <p>
        Der Zähler läuft pro Kalendermonat und springt am Monatsersten wieder auf
        null. Du siehst deinen Stand in den Einstellungen und unter Abrechnung.
      </p>

      <h2>Was nichts kostet</h2>
      <p>Gar nicht gezählt werden:</p>
      <ul>
        <li>
          <Link href="/docs/ergebnisse">Prompts speichern</Link>, dabei wird kein
          Modell aufgerufen
        </li>
        <li>Kopieren, Markdown- und PDF-Export</li>
        <li>Projekte anlegen, Dateien hochladen, Chats umbenennen</li>
      </ul>

      <h2>Mit eigenem Key</h2>
      <p>
        Hinterlegst du einen{" "}
        <Link href="/docs/eigene-api-keys">eigenen API-Key</Link>, entfällt das
        monatliche Nachrichtenlimit vollständig, in jedem Plan. Du zahlst die
        Modellnutzung dann direkt bei deinem Anbieter. Auf Free ist das kein
        Bonus, sondern die Voraussetzung, ohne Key läuft dort kein Chat.
      </p>

      <h2>Der Schutz pro Stunde</h2>
      <p>
        Unabhängig vom Monatslimit gibt es eine stündliche Obergrenze. Die ist
        kein Sparmodell, sondern verhindert, dass ein Skript oder ein Fehler den
        Dienst für alle lahmlegt. Im normalen Arbeiten wirst du sie nicht
        bemerken, sie greift auch mit eigenem Key. Läufst du doch hinein,
        bekommst du eine deutliche Meldung und kannst es kurz darauf wieder
        versuchen.
      </p>

      <h2>Wenn ein Limit erreicht ist</h2>
      <p>
        Du bekommst eine klare Meldung, die sagt, welches Limit es war und was du
        tun kannst. Nichts geht dabei verloren, deine Chats und Projekte bleiben
        vollständig erhalten und lesbar.
      </p>
    </DocsShell>
  );
}

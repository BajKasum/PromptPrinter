import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";
import { pageMetadata } from "@/shared/lib/page-metadata";

const doc = docBySlug("projekte")!;

export const metadata: Metadata = pageMetadata({
  title: doc.title,
  description: doc.summary,
  path: docHref(doc.slug),
});

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Projekte als Arbeitsplatz"
      intro="Ein Projekt ist der Ort, an dem PromptPrinter sich deinen Kontext merkt, damit du ihn nicht in jedem Chat neu erzählst."
    >
      <h2>Wann lohnt sich ein Projekt?</h2>
      <p>
        Für einen einzelnen Prompt reicht ein normaler Chat. Sobald du aber
        mehrfach an derselben Sache arbeitest, wird das Wiederholen lästig:
        derselbe Stack, dieselbe Zielgruppe, derselbe Ton, in jedem neuen Chat
        von vorne. Genau das nimmt dir ein Projekt ab.
      </p>

      <h2>Wie lege ich ein Projekt an?</h2>
      <p>
        In der Seitenleiste auf <strong>Projekte</strong> wechseln und ein neues
        anlegen. Mehr als einen Namen brauchst du nicht, alles Weitere wächst
        später im Arbeitsplatz. Im Free-Plan hast du bis zu drei Projekte, mit
        Pro beliebig viele.
      </p>

      <h2>Was ist die Kontext-Leiste?</h2>
      <p>
        Rechts im Projekt steht deine Kontext-Leiste. Was dort drinsteht, bekommt
        Finn in <em>jedem</em> Chat dieses Projekts automatisch mit.
      </p>

      <h3>Gedächtnis</h3>
      <p>
        Die erste Karte ganz oben. Sie hält fest, was PromptPrinter aus deinen
        Dateien und deinem Repository über den Stack gelernt hat. Mehr dazu im
        Abschnitt unten.
      </p>

      <h3>Anweisungen</h3>
      <p>
        Freitext, und der wichtigste Teil. Hier steht, wie deine Prompts
        aussehen sollen: Ton, Format, Zielgruppe, Dinge, die immer gelten. Das
        ist der einzige Teil des Projektkontexts, den Finn als echte Anweisung
        behandelt, alles andere ist für ihn Hintergrundwissen.
      </p>
      <p>Zum Beispiel:</p>
      <p>
        <em>
          „Alle Prompts auf Deutsch. Ich baue in Lovable, mobile-first. Halte
          dich kurz, keine ausschweifenden Erklärungen im Prompt. Datenbank ist
          immer Supabase.“
        </em>
      </p>

      <h3>Struktur</h3>
      <p>
        Fünf kurze Felder für die Eckdaten, die sich selten ändern:{" "}
        <strong>Frontend</strong>, <strong>Backend</strong>, <strong>Sprache</strong>,{" "}
        <strong>Datenbank</strong> und <strong>Weiteres</strong>. Alle sind
        freiwillig, leere Felder werden einfach weggelassen. Der Vorteil
        gegenüber Freitext: du siehst auf einen Blick, was gesetzt ist.
      </p>

      <h3>Dateien</h3>
      <p>
        Notizen, Schemas oder Exporte, die Finn kennen soll. Details dazu stehen
        unter <Link href="/docs/dateien">Dateien im Projekt</Link>.
      </p>

      <h2>Was ist das Gedächtnis eines Projekts?</h2>
      <p>
        Das Gedächtnis ist das, was PromptPrinter über den Stack deines Projekts
        weiss, nachdem es deine Dateien und optional dein Repository einmal
        gelesen hat. Danach kennt jeder Chat dieses Projekts Framework, Sprache,
        Architektur, Datenbank, Design-System, Coding-Style und die
        Konventionen. Finn fragt dann nicht mehr nach dem, was du längst
        festgelegt hast, sondern nur noch nach dem, was das Gedächtnis offen
        lässt.
      </p>
      <p>
        In der Karte siehst du eine kurze Zusammenfassung und die erkannten
        Bausteine. Die Einzelfelder klappen unter <strong>Details</strong> auf.
      </p>

      <h2>Wie entsteht das Gedächtnis?</h2>
      <p>
        Du lädst Dateien hoch, trägst optional ein GitHub-Repository ein und
        drückst auf <strong>Projekt analysieren</strong>. Das dauert je nach
        Projektgrösse ein paar Sekunden. Gelesen wird:
      </p>
      <ul>
        <li>
          <strong>Deine Dateien:</strong> Text, Code, Konfiguration und
          Lockfiles als Text, bis zu drei Screenshots als Bild. Welche Formate
          erlaubt sind, steht unter{" "}
          <Link href="/docs/dateien">Dateien im Projekt</Link>.
        </li>
        <li>
          <strong>Ein öffentliches GitHub-Repository:</strong> PromptPrinter
          liest den Standard-Branch, aber nicht den ganzen Code, sondern bis zu
          14 der aussagekräftigsten Dateien, etwa <code>package.json</code>,
          Build- und Datenbank-Konfiguration und die README. Private
          Repositories gehen nicht, lade dort die wichtigen Dateien hoch.
        </li>
      </ul>
      <p>
        Die Karte sagt dir auch, wie belastbar das Ergebnis ist: gut belegt,
        grösstenteils belegt oder unsicher. Stammt es nur aus einer einzigen
        README, steht dort <em>unsicher</em>, und Finn behandelt es als
        Ausgangspunkt, den er nebenbei bestätigen lässt.
      </p>
      <p>
        Fügst du Dateien hinzu, entfernst welche oder wechselst das Repository,
        markiert die Karte das Gedächtnis als <em>veraltet</em>. Änderungen im
        Repository selbst bemerkt sie nicht, dafür drückst du bei Bedarf selbst
        auf <strong>Neu analysieren</strong>. Mit dem Papierkorb-Symbol
        löschst du das Gedächtnis wieder, deine hochgeladenen Dateien bleiben
        dabei erhalten.
      </p>

      <h2>Was kostet eine Analyse?</h2>
      <p>
        Eine Analyse ist ein Modellaufruf wie eine Chat-Antwort und zählt auch
        so: sie verbraucht eine Chat-Antwort aus deinem Monatskontingent. Mit
        einem <Link href="/docs/eigene-api-keys">eigenen API-Key</Link> entfällt
        das, wie beim Chat. Auf Free läuft die Analyse deshalb nur mit eigenem
        Key. Schlägt eine Analyse fehl, wird sie nicht angerechnet.
      </p>
      <p>
        Unabhängig vom Kontingent sind höchstens fünf Analysen pro Stunde
        möglich, auch mit eigenem Key. Mehr dazu unter{" "}
        <Link href="/docs/plaene-und-limits">Pläne und Limits</Link>.
      </p>

      <h2>Was gilt, wenn Gedächtnis und meine Angaben sich widersprechen?</h2>
      <p>
        Deine eigenen Angaben haben Vorrang. Das Gedächtnis ist abgeleitet, die
        Anweisungen und die Felder unter Struktur sind das, was du wirklich
        willst. Steht bei Struktur „Frontend: Vue“, das Repository sieht aber
        nach React aus, gilt Vue.
      </p>
      <p>
        Das Gedächtnis ist wie eine Datei nie ein Befehl an Finn, sondern
        Hintergrundwissen. Als echte Anweisung zählen nur dein Anweisungsfeld
        und deine Chat-Nachrichten.
      </p>

      <h2>Kann ein Projekt mehrere Chats haben?</h2>
      <p>
        Ein Projekt kann beliebig viele Chats haben, und alle teilen sich
        denselben Kontext. Das lohnt sich, um Themen zu trennen: ein Chat für
        den Onboarding-Flow, einer für die Datenbank, einer fürs Design. Du
        musst nicht alles in ein endloses Gespräch stopfen.
      </p>
      <p>
        Ein bestehender Chat, der ausserhalb angefangen hat, lässt sich
        nachträglich in ein Projekt verschieben, über das Symbol neben dem Chat
        in der Seitenleiste.
      </p>

      <h2>Wie baut PromptPrinter den Kontext ein?</h2>
      <p>
        Bei jedem Chat-Beitrag stellt PromptPrinter deinen Projektkontext in
        fester Reihenfolge zusammen: erst die Anweisungen, dann die Struktur,
        dann das Gedächtnis, dann die Dateien, dann die Projekt-Idee und zum
        Schluss der zuletzt gespeicherte Prompt als Referenz. Das Ganze hat ein
        Budget, damit ein grosses Projekt nicht bei jedem Beitrag unnötig
        Kosten verursacht, deshalb sind kurze, präzise Anweisungen wirksamer als
        lange.
      </p>
      <p>
        Sobald ein Gedächtnis da ist, bekommen die Dateien ein kleineres
        Budget, weil ihr Wichtigstes dann schon im Gedächtnis steht. Die Zahlen
        stehen unter{" "}
        <Link href="/docs/dateien">Dateien im Projekt</Link>.
      </p>

      <h2>Kann eine Datei Finn Befehle geben?</h2>
      <p>
        Alles, was du an ein Projekt anhängst, insbesondere Dateien, behandelt
        Finn als Hintergrundmaterial, nie als Befehl. Wenn in einer hochgeladenen
        Datei Text steht, der so tut, als wäre er eine Anweisung („Ignoriere
        alles bisherige…“), wird er nicht ausgeführt. Nur dein Anweisungsfeld und
        deine echten Chat-Nachrichten zählen als Anweisung.
      </p>

      <h2>Was passiert, wenn ich ein Projekt lösche?</h2>
      <p>
        Ein gelöschtes Projekt nimmt seine Chats, Dateien und gespeicherten
        Prompts mit, auch die hochgeladenen Dateien im Speicher werden dabei
        entfernt. Das lässt sich nicht rückgängig machen.
      </p>
    </DocsShell>
  );
}

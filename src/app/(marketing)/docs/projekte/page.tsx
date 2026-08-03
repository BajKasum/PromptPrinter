import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";

const doc = docBySlug("projekte")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Projekte als Arbeitsplatz"
      intro="Ein Projekt ist der Ort, an dem PromptPrinter sich deinen Kontext merkt, damit du ihn nicht in jedem Chat neu erzählst."
    >
      <h2>Wann sich ein Projekt lohnt</h2>
      <p>
        Für einen einzelnen Prompt reicht ein normaler Chat. Sobald du aber
        mehrfach an derselben Sache arbeitest, wird das Wiederholen lästig:
        derselbe Stack, dieselbe Zielgruppe, derselbe Ton, in jedem neuen Chat
        von vorne. Genau das nimmt dir ein Projekt ab.
      </p>

      <h2>Anlegen</h2>
      <p>
        In der Seitenleiste auf <strong>Projekte</strong> wechseln und ein neues
        anlegen. Mehr als einen Namen brauchst du nicht, alles Weitere wächst
        später im Arbeitsplatz. Im Free-Plan hast du bis zu drei Projekte, mit
        Pro beliebig viele.
      </p>

      <h2>Die Kontext-Leiste</h2>
      <p>
        Rechts im Projekt steht deine Kontext-Leiste. Was dort drinsteht, bekommt
        Finn in <em>jedem</em> Chat dieses Projekts automatisch mit.
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
        Sechs kurze Felder für die Eckdaten, die sich selten ändern:{" "}
        <strong>Ziel-KI</strong>, <strong>Frontend</strong>,{" "}
        <strong>Backend</strong>, <strong>Sprache</strong>,{" "}
        <strong>Datenbank</strong> und <strong>Weiteres</strong>. Alle sind
        freiwillig, leere Felder werden einfach weggelassen. Der Vorteil
        gegenüber Freitext: du siehst auf einen Blick, was gesetzt ist.
      </p>

      <h3>Dateien</h3>
      <p>
        Notizen, Schemas oder Exporte, die Finn kennen soll. Details dazu stehen
        unter <Link href="/docs/dateien">Dateien im Projekt</Link>.
      </p>

      <h2>Mehrere Chats pro Projekt</h2>
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

      <h2>Wie der Kontext eingebaut wird</h2>
      <p>
        Bei jedem Chat-Beitrag stellt PromptPrinter deinen Projektkontext in
        fester Reihenfolge zusammen: erst die Anweisungen, dann die Struktur,
        dann die Dateien, dann die Projekt-Idee und zum Schluss der zuletzt
        gespeicherte Prompt als Referenz. Das Ganze hat ein Budget, damit ein
        grosses Projekt nicht bei jedem Beitrag unnötig Kosten verursacht,
        deshalb sind kurze, präzise Anweisungen wirksamer als lange.
      </p>

      <h2>Ein Sicherheitshinweis</h2>
      <p>
        Alles, was du an ein Projekt anhängst, insbesondere Dateien, behandelt
        Finn als Hintergrundmaterial, nie als Befehl. Wenn in einer hochgeladenen
        Datei Text steht, der so tut, als wäre er eine Anweisung („Ignoriere
        alles bisherige…“), wird er nicht ausgeführt. Nur dein Anweisungsfeld und
        deine echten Chat-Nachrichten zählen als Anweisung.
      </p>

      <h2>Löschen</h2>
      <p>
        Ein gelöschtes Projekt nimmt seine Chats, Dateien und gespeicherten
        Prompts mit, auch die hochgeladenen Dateien im Speicher werden dabei
        entfernt. Das lässt sich nicht rückgängig machen.
      </p>
    </DocsShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/lib/docs-nav";

const doc = docBySlug("der-fertige-prompt")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Der fertige Prompt"
      intro="Was am Ende herauskommt, wie du ihn mitnimmst und wie du ihn änderst, ohne von vorne anzufangen."
    >
      <h2>Was drinsteht</h2>
      <p>
        Der Prompt kommt immer als ein Stück, in einem eigenen Codeblock. Er ist
        so gebaut, dass er für sich allein steht, das Bau-Tool braucht euer
        Gespräch nicht mitgelesen zu haben:
      </p>
      <ul>
        <li>eine klare Rolle und Rahmensetzung</li>
        <li>die konkrete Aufgabe</li>
        <li>den Kontext, den das Tool kennen muss</li>
        <li>
          ausdrückliche Einschränkungen, also auch was <em>nicht</em> gebaut
          werden soll
        </li>
        <li>das gewünschte Verhalten oder Ausgabeformat</li>
      </ul>
      <p>
        Im Codeblock steht ausschliesslich der Prompt selbst, keine Erklärungen
        oder Kommentare von Finn. Du kannst ihn also ohne Nachbearbeitung
        einfügen.
      </p>

      <h2>Kopieren und exportieren</h2>
      <p>
        Über dem Codeblock sitzt der Kopieren-Knopf, das ist der übliche Weg.
        Zusätzlich kannst du jede Antwort als Ganzes kopieren oder als
        Markdown-Datei herunterladen, praktisch, wenn du den Prompt neben dem
        Code im Repo ablegen willst.
      </p>
      <p>
        Arbeitest du in einem Projekt, kannst du den Prompt ausserdem in die{" "}
        <Link href="/docs/ergebnisse">Ergebnisse</Link> speichern und später
        wiederfinden.
      </p>

      <h2>Nachschärfen statt neu starten</h2>
      <p>
        Der häufigste Fehler ist, für jede Änderung einen neuen Chat
        aufzumachen. Bleib im selben Gespräch und sag einfach, was anders sein
        soll:
      </p>
      <ul>
        <li>„Deutlich kürzer, das ist zu lang für einen ersten Wurf.“</li>
        <li>„Nimm Supabase statt Firebase.“</li>
        <li>„Der Ton soll sachlicher sein, weniger Marketing.“</li>
        <li>„Ergänze, dass alte Einträge archiviert statt gelöscht werden.“</li>
      </ul>
      <p>
        Du bekommst jedes Mal den kompletten überarbeiteten Prompt zurück. Damit
        ist die letzte Antwort im Chat immer die gültige Fassung, du musst nie
        Versionen zusammensuchen.
      </p>

      <h2>Wenn der Prompt Lücken enthält</h2>
      <p>
        Steht irgendwo <code>[dein Wert]</code> oder etwas Ähnliches in eckigen
        Klammern, ist das Absicht: an der Stelle fehlte eine Information, und
        Finn rät bewusst nicht. Füll die Lücke selbst aus, oder sag im Chat, was
        dort hingehört, dann kommt der Prompt vollständig zurück.
      </p>

      <h2>Wie viel vom Gespräch zählt</h2>
      <p>
        Für die Antwort werden die letzten Nachrichten des Gesprächs
        berücksichtigt, nicht der komplette Verlauf. Das hält die Kosten unten
        und stört in der Praxis nicht, weil jede Antwort ohnehin den ganzen
        aktuellen Prompt enthält. Bei einem sehr langen Chat, der weit weg vom
        Ausgangspunkt gewandert ist, lohnt es sich trotzdem, die wichtigsten
        Eckdaten noch einmal kurz zu wiederholen, oder gleich mit einem{" "}
        <Link href="/docs/projekte">Projekt</Link> zu arbeiten.
      </p>
    </DocsShell>
  );
}

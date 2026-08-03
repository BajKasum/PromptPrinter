import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILES_PER_PROJECT,
  MAX_FILE_BYTES,
} from "@/features/projects/lib/project-files";

const doc = docBySlug("dateien")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

// Limits are read from the same module the upload UI enforces them with, so
// this page can't drift away from the actual rule.
const MAX_FILE_KB = MAX_FILE_BYTES / 1024;

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Dateien im Projekt"
      intro="Statt deinen Kontext abzutippen, häng ihn an: Notizen, ein Datenbankschema, eine Beispiel-Datei."
    >
      <h2>Hochladen</h2>
      <p>
        Im Projekt findest du in der Kontext-Leiste den Bereich{" "}
        <strong>Dateien</strong>. Was du dort hochlädst, steht Finn in jedem Chat
        dieses Projekts zur Verfügung.
      </p>

      <h2>Was erlaubt ist</h2>
      <ul>
        <li>
          <strong>Formate:</strong>{" "}
          <code>{ALLOWED_FILE_EXTENSIONS.join(", ")}</code>
        </li>
        <li>
          <strong>Höchstens {MAX_FILES_PER_PROJECT} Dateien</strong> pro Projekt
        </li>
        <li>
          <strong>Bis {MAX_FILE_KB} KB</strong> pro Datei
        </li>
      </ul>
      <p>
        Die Liste ist bewusst kurz gehalten. Es sind genau die Textformate, die
        sich sauber in einen Prompt einbauen lassen. PDFs, Word-Dateien oder
        Bilder gehen nicht, kopier daraus lieber den relevanten Teil in eine{" "}
        <code>.md</code>- oder <code>.txt</code>-Datei.
      </p>

      <h2>Was sich gut eignet</h2>
      <ul>
        <li>ein Datenbankschema oder ein SQL-Auszug</li>
        <li>deine Notizen zur Zielgruppe oder zum Funktionsumfang</li>
        <li>ein Style-Guide oder eine Liste von Design-Regeln</li>
        <li>eine <code>.csv</code> mit Beispieldaten, damit die Felder klar sind</li>
        <li>eine bestehende <code>README.md</code> aus deinem Repo</li>
      </ul>

      <h2>Wie viel davon wirklich ankommt</h2>
      <p>
        Die Dateien teilen sich ein gemeinsames Kontextbudget von rund 12 000
        Zeichen, pro Datei höchstens etwa 3 000. Das klingt nach wenig, ist aber
        Absicht: der Kontext wird bei <em>jedem</em> Chat-Beitrag mitgeschickt,
        eine unbegrenzte Menge würde jede Nachricht teuer machen.
      </p>
      <p>Konkret heisst das:</p>
      <ul>
        <li>
          <code>.md</code>-Dateien kommen zuerst dran, danach der Rest in der
          Reihenfolge des Hochladens
        </li>
        <li>zu lange Dateien werden gekürzt, nicht weggelassen</li>
        <li>
          was gar nicht mehr ins Budget passt, wird Finn wenigstens noch
          namentlich genannt, damit er weiss, dass es existiert
        </li>
      </ul>
      <p>
        Praktische Folge: <strong>eine kurze, gezielte Datei schlägt einen
        kompletten Export.</strong> Lade lieber das Schema hoch als den ganzen
        Datenbank-Dump.
      </p>

      <h2>Dateien sind Material, keine Befehle</h2>
      <p>
        Der Inhalt deiner Dateien wird ausdrücklich als Hintergrundmaterial
        behandelt. Steht darin Text, der wie eine Anweisung klingt, wird er nicht
        befolgt, sondern nur gelesen. Das schützt dich, wenn du fremde Dateien
        anhängst, etwa ein Dokument, das du nicht selbst geschrieben hast.
        Anweisungen gibst du im Feld{" "}
        <Link href="/docs/projekte">Anweisungen</Link> oder direkt im Chat.
      </p>

      <h2>Löschen</h2>
      <p>
        Dateien lassen sich einzeln wieder entfernen. Sie liegen in einem
        privaten Speicher, auf den nur dein eigenes Konto Zugriff hat, und
        verschwinden vollständig, wenn du die Datei, das Projekt oder dein{" "}
        <Link href="/docs/konto-und-daten">Konto</Link> löschst.
      </p>
    </DocsShell>
  );
}

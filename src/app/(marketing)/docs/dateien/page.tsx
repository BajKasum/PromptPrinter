import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILES_PER_PROJECT,
  MAX_IMAGE_BYTES,
  MAX_LOCKFILE_BYTES,
  MAX_PROJECT_FILE_BYTES,
  MAX_TEXT_FILE_BYTES,
  fileKind,
} from "@/features/projects/lib/project-files";
import { pageMetadata } from "@/shared/lib/page-metadata";

const doc = docBySlug("dateien")!;

export const metadata: Metadata = pageMetadata({
  title: doc.title,
  description: doc.summary,
  path: docHref(doc.slug),
});

// Limits are read from the same module the upload UI enforces them with, so
// this page can't drift away from the actual rule. The format groups are
// derived with fileKind() for the same reason: an extension is never listed
// under a size limit the upload gate wouldn't apply to it.
const MAX_TEXT_KB = MAX_TEXT_FILE_BYTES / 1024;
const MAX_LOCKFILE_MB = MAX_LOCKFILE_BYTES / (1024 * 1024);
const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);
const MAX_PROJECT_MB = MAX_PROJECT_FILE_BYTES / (1024 * 1024);

const TEXT_FORMATS = ALLOWED_FILE_EXTENSIONS.filter((ext) => fileKind(`x${ext}`) === "text");
const IMAGE_FORMATS = ALLOWED_FILE_EXTENSIONS.filter((ext) => fileKind(`x${ext}`) === "image");

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Dateien im Projekt"
      intro="Statt deinen Kontext abzutippen, häng ihn an: Notizen, ein Datenbankschema, eine Beispiel-Datei."
    >
      <h2>Wie lade ich eine Datei hoch?</h2>
      <p>
        Im Projekt findest du in der Kontext-Leiste den Bereich{" "}
        <strong>Dateien</strong>. Was du dort hochlädst, steht Finn in jedem Chat
        dieses Projekts zur Verfügung.
      </p>

      <h2>Welche Dateien sind erlaubt?</h2>
      <p>Erlaubt sind drei Arten von Dateien, jede mit eigener Grössengrenze:</p>
      <ul>
        <li>
          <strong>Text, Code und Konfiguration, bis {MAX_TEXT_KB} KB:</strong>{" "}
          <code>{TEXT_FORMATS.join(", ")}</code>
        </li>
        <li>
          <strong>Lockfiles, bis {MAX_LOCKFILE_MB} MB:</strong> alles mit der
          Endung <code>.lock</code> (etwa <code>yarn.lock</code>) sowie{" "}
          <code>package-lock.json</code> und <code>pnpm-lock.yaml</code>. Sie
          dürfen grösser sein als eine Notiz, weil sie bei einem mittelgrossen
          Projekt schnell mehrere hundert KB erreichen.
        </li>
        <li>
          <strong>Bilder, bis {MAX_IMAGE_MB} MB:</strong>{" "}
          <code>{IMAGE_FORMATS.join(", ")}</code>
        </li>
      </ul>
      <p>
        Dazu gelten zwei Grenzen für das ganze Projekt:{" "}
        <strong>höchstens {MAX_FILES_PER_PROJECT} Dateien</strong>, die
        zusammen <strong>höchstens {MAX_PROJECT_MB} MB</strong> gross sein
        dürfen.
      </p>

      <h2>Wofür sind Bilder gedacht?</h2>
      <p>
        Bilder, etwa Screenshots deiner App, sind Quellen für das{" "}
        <Link href="/docs/projekte">Gedächtnis</Link> des Projekts. Bei der
        Analyse schaut sich PromptPrinter bis zu drei davon an und liest die
        Design-Richtung daraus ab: Layout, Farbwelt, Stil der Bedienelemente.
        Es sind die drei, die du zuerst hochgeladen hast, weitere bleiben im
        Projekt liegen, fliessen aber nicht ein.
      </p>
      <p>
        In deine Chats kommen Bilder nicht mit. Finn sieht einen Screenshot
        also nie direkt, sondern nur das, was die Analyse daraus festgehalten
        hat. Ohne Analyse bleibt ein Bild für ihn unsichtbar.
      </p>

      <h2>Was geht nicht?</h2>
      <p>
        Alles, was in den Listen oben fehlt, lehnt der Upload ab. Das betrifft
        vor allem PDFs, Word-Dateien, Excel-Tabellen, GIFs und Design-Dateien
        aus Figma oder Sketch. Kopier aus einem PDF oder Word-Dokument lieber
        den relevanten Teil in eine <code>.md</code>- oder{" "}
        <code>.txt</code>-Datei, exportier eine Tabelle als <code>.csv</code>{" "}
        und ein Design als <code>.png</code>.
      </p>

      <h2>Welche Dateien eignen sich gut?</h2>
      <ul>
        <li>ein Datenbankschema oder ein SQL-Auszug</li>
        <li>deine Notizen zur Zielgruppe oder zum Funktionsumfang</li>
        <li>ein Style-Guide oder eine Liste von Design-Regeln</li>
        <li>eine <code>.csv</code> mit Beispieldaten, damit die Felder klar sind</li>
        <li>eine bestehende <code>README.md</code> aus deinem Repo</li>
        <li>
          eine <code>package.json</code> oder <code>tsconfig.json</code>, aus
          der sich dein Stack ablesen lässt
        </li>
      </ul>

      <h2>Wie viel von meinen Dateien kommt bei Finn an?</h2>
      <p>
        Die Dateien teilen sich ein gemeinsames Kontextbudget. Das klingt nach
        wenig, ist aber Absicht: der Kontext wird bei <em>jedem</em>{" "}
        Chat-Beitrag mitgeschickt, eine unbegrenzte Menge würde jede Nachricht
        teuer machen. Wie gross das Budget ist, hängt davon ab, ob dein Projekt
        schon ein <Link href="/docs/projekte">Gedächtnis</Link> hat:
      </p>
      <ul>
        <li>
          <strong>Ohne Gedächtnis:</strong> rund 12 000 Zeichen insgesamt, pro
          Datei höchstens etwa 3 000.
        </li>
        <li>
          <strong>Mit Gedächtnis:</strong> rund 6 000 Zeichen insgesamt, pro
          Datei höchstens etwa 2 000. Dazu kommt der Gedächtnis-Block selbst,
          höchstens 2 500 Zeichen.
        </li>
      </ul>
      <p>
        Das kleinere Dateibudget ist kein Verlust. Was Finn über Stack und
        Aufbau wissen muss, steht dann schon im Gedächtnis und muss nicht bei
        jedem Beitrag neu aus den Rohdateien gelesen werden. Zusammen sind es
        höchstens 8 500 statt 12 000 Zeichen.
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
        <li>Bilder zählen nicht mit, sie kommen gar nicht in den Chat</li>
      </ul>
      <p>
        Praktische Folge: <strong>eine kurze, gezielte Datei schlägt einen
        kompletten Export.</strong> Lade lieber das Schema hoch als den ganzen
        Datenbank-Dump.
      </p>
      <p>
        Die einmalige Analyse für das Gedächtnis liest dagegen deutlich mehr:
        Dateien und Repository zusammen bis zu 60 000 Zeichen Text, pro Datei
        bis zu 12 000. Sie liest einmal ausführlich, das Ergebnis reist danach bei
        jedem Beitrag mit.
      </p>

      <h2>Führt Finn Anweisungen aus einer Datei aus?</h2>
      <p>
        Der Inhalt deiner Dateien wird ausdrücklich als Hintergrundmaterial
        behandelt. Steht darin Text, der wie eine Anweisung klingt, wird er nicht
        befolgt, sondern nur gelesen. Das schützt dich, wenn du fremde Dateien
        anhängst, etwa ein Dokument, das du nicht selbst geschrieben hast.
        Anweisungen gibst du im Feld{" "}
        <Link href="/docs/projekte">Anweisungen</Link> oder direkt im Chat.
      </p>

      <h2>Wie lösche ich eine Datei?</h2>
      <p>
        Dateien lassen sich einzeln wieder entfernen. Sie liegen in einem
        privaten Speicher, auf den nur dein eigenes Konto Zugriff hat, und
        verschwinden vollständig, wenn du die Datei, das Projekt oder dein{" "}
        <Link href="/docs/konto-und-daten">Konto</Link> löschst.
      </p>
    </DocsShell>
  );
}

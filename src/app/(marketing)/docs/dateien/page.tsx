import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILES_PER_PROJECT,
  MAX_IMAGE_BYTES,
  MAX_LOCKFILE_BYTES,
  MAX_PROJECT_FILE_BYTES,
  MAX_TEXT_FILE_BYTES,
  fileKind,
} from "@/features/projects/lib/project-files";
import {
  ANALYSIS_TEXT_PER_FILE_BUDGET,
  ANALYSIS_TEXT_TOTAL_BUDGET,
  FILES_PER_FILE_CAP,
  FILES_PER_FILE_CAP_WITH_BRAIN,
  FILES_TOTAL_BUDGET,
  FILES_TOTAL_BUDGET_WITH_BRAIN,
  MAX_ANALYSIS_IMAGES,
} from "@/features/projects/lib/context-budgets";
import { BRAIN_PROMPT_BUDGET } from "@/shared/lib/project-brain";
import { docMetadata } from "@/features/marketing/lib/article-metadata";

const doc = docBySlug("dateien")!;

export const metadata: Metadata = docMetadata(doc);

// Jede Grenze auf dieser Seite kommt aus dem Modul, das sie durchsetzt (project-files.ts beim Upload,
// context-budgets.ts und project-brain.ts im Kontext), damit der Artikel nicht von der Regel abweicht. Die Formate
// sind aus demselben Grund mit fileKind() abgeleitet: keine Endung steht unter einer Grösse, die der Upload für sie
// nicht anlegt.
const chars = (n: number) => n.toLocaleString("de-CH");
const NUMBER_WORDS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"];
const ANALYSIS_IMAGES = NUMBER_WORDS[MAX_ANALYSIS_IMAGES] ?? String(MAX_ANALYSIS_IMAGES);

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
        dieses Projekts zur Verfügung. Für eine einzelne Nachricht gibt es
        den Plus-Knopf im Chat, siehe{" "}
        <Link href="/docs/chat-mit-finn">Chat mit Finn</Link>.
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
        Analyse schaut sich PromptPrinter bis zu {ANALYSIS_IMAGES} davon an und
        liest die Design-Richtung daraus ab: Layout, Farbwelt, Stil der
        Bedienelemente. Es sind die {ANALYSIS_IMAGES}, die du zuerst hochgeladen
        hast, weitere bleiben im Projekt liegen, fliessen aber nicht ein.
      </p>
      <p>
        In deine Chats kommen die Bilder eines Projekts nicht von selbst mit.
        Finn sieht sie also nicht direkt, sondern nur das, was die Analyse
        daraus festgehalten hat. Ohne Analyse bleibt ein Projektbild für ihn
        unsichtbar. Soll Finn einen Screenshot wirklich ansehen, häng ihn mit
        dem Plus-Knopf an eine Nachricht.
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
          <strong>Ohne Gedächtnis:</strong> rund {chars(FILES_TOTAL_BUDGET)}{" "}
          Zeichen insgesamt, pro Datei höchstens etwa{" "}
          {chars(FILES_PER_FILE_CAP)}.
        </li>
        <li>
          <strong>Mit Gedächtnis:</strong> rund{" "}
          {chars(FILES_TOTAL_BUDGET_WITH_BRAIN)} Zeichen insgesamt, pro Datei
          höchstens etwa {chars(FILES_PER_FILE_CAP_WITH_BRAIN)}. Dazu kommt der
          Gedächtnis-Block selbst, höchstens {chars(BRAIN_PROMPT_BUDGET)}{" "}
          Zeichen.
        </li>
      </ul>
      <p>
        Das kleinere Dateibudget ist kein Verlust. Was Finn über Stack und
        Aufbau wissen muss, steht dann schon im Gedächtnis und muss nicht bei
        jedem Beitrag neu aus den Rohdateien gelesen werden. Zusammen sind es
        höchstens {chars(FILES_TOTAL_BUDGET_WITH_BRAIN + BRAIN_PROMPT_BUDGET)}{" "}
        statt {chars(FILES_TOTAL_BUDGET)} Zeichen.
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
        <li>
          Bilder aus dem Projekt zählen nicht mit, sie kommen nicht in den Chat
        </li>
      </ul>
      <p>
        Praktische Folge: <strong>eine kurze, gezielte Datei schlägt einen
        kompletten Export.</strong> Lade lieber das Schema hoch als den ganzen
        Datenbank-Dump.
      </p>
      <p>
        Die einmalige Analyse für das Gedächtnis liest dagegen deutlich mehr:
        Dateien und Repository zusammen bis zu{" "}
        {chars(ANALYSIS_TEXT_TOTAL_BUDGET)} Zeichen Text, pro Datei bis zu{" "}
        {chars(ANALYSIS_TEXT_PER_FILE_BUDGET)}. Sie liest einmal ausführlich,
        das Ergebnis reist danach bei jedem Beitrag mit.
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

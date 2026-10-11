import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";
import { pageMetadata } from "@/shared/lib/page-metadata";
import {
  ATTACHMENT_TEXT_CHARS_PER_FILE,
  MAX_ATTACHMENT_STORAGE_PER_USER,
  MAX_ATTACHMENT_TEXT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MODEL_IMAGES,
} from "@/shared/lib/chat-limits";

// Die Zahlen unten kommen aus chat-limits.ts, derselben Quelle, die Composer
// und Server durchsetzen. So kann die Seite nicht von der Regel wegdriften.
const MAX_TEXT_KB = MAX_ATTACHMENT_TEXT_BYTES / 1024;
const MAX_STORAGE_MB = MAX_ATTACHMENT_STORAGE_PER_USER / (1024 * 1024);

const doc = docBySlug("chat-mit-finn")!;

export const metadata: Metadata = pageMetadata({
  title: doc.title,
  description: doc.summary,
  path: docHref(doc.slug),
});

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Chat mit Finn"
      intro="Finn liefert nicht sofort. Er fragt erst einmal nach, und genau das ist der Punkt."
    >
      <h2>Warum fragt Finn erst nach?</h2>
      <p>
        Eine KI fängt sofort an, auch wenn dein Prompt die Hälfte offen lässt.
        Was fehlt, erfindet sie, und du merkst es erst, wenn das Ergebnis
        danebenliegt. Jede Korrekturrunde kostet dich Zeit, und je nach Tool
        auch Credits.
      </p>
      <p>
        Deshalb macht Finn vorher den Vollständigkeits-Durchgang: eine einzige
        gebündelte Nachricht mit den Punkten, die für <em>deine</em> Aufgabe
        wirklich zählen. Welche das sind, hängt davon ab, worum es geht:
      </p>
      <ul>
        <li>
          <strong>Bei einem Text:</strong> für wen er ist, in welchem Ton, wie
          lang und in welchem Format
        </li>
        <li>
          <strong>Bei einer Webseite oder App:</strong> die wichtigsten Seiten
          oder Abläufe, was gespeichert wird, ob es Konten gibt und in welche
          Design-Richtung es gehen soll
        </li>
        <li>
          <strong>Bei einer Datenbank, einer Analyse oder einer
          Sicherheitsprüfung:</strong> um welches System es geht, welche Technik
          dahintersteckt, wie weit die Aufgabe reicht und woran du ein gutes
          Ergebnis erkennst
        </li>
        <li>
          <strong>Die KI, für die der Prompt gedacht ist:</strong> nur, wenn es
          den Prompt verändert, zum Beispiel bei einem Code- oder
          Bild-Werkzeug
        </li>
      </ul>
      <p>
        Was auf deine Aufgabe nicht zutrifft, lässt Finn weg. Die Frage wird
        nicht künstlich aufgefüllt.
      </p>

      <h2>Wie beantworte ich die Rückfrage am schnellsten?</h2>
      <p>
        Alles in eine Nachricht, in beliebiger Reihenfolge, Stichworte reichen.
        Du musst nicht sauber pro Punkt gliedern, Finn sortiert das.
      </p>
      <p>
        Unklarheiten darfst du offen lassen. Schreib ruhig „weiss ich noch
        nicht“, dann setzt Finn an der Stelle eine sichtbare Lücke wie{" "}
        <code>[dein Wert]</code> in den Prompt, statt sich etwas zu erfinden, das
        das später falsch in der Antwort der KI landet.
      </p>

      <h2>Wie sage ich Finn, für welche KI der Prompt ist?</h2>
      <p>
        Du musst nicht. Ohne Angabe schreibt Finn den Prompt so, dass er in
        jeder KI funktioniert. Willst du ihn auf eine bestimmte zuschneiden,
        sagst du es einfach im Gespräch, etwa „für ChatGPT“ oder „für ein
        Bild-Werkzeug“, und der Prompt wird auf deren Eigenheiten angepasst. Es
        gibt bewusst kein Auswahlmenü dafür.
      </p>

      <h2>Kann ich Screenshots und Dateien an eine Nachricht hängen?</h2>
      <p>
        Ja. Links neben dem Eingabefeld ist ein <strong>Plus</strong>: ein Klick
        öffnet die Dateiauswahl. Ein Screenshot sagt Finn oft mehr als dein
        Satz, etwa wie dein Entwurf aussieht, welche Fehlermeldung du bekommst
        oder was in deiner Anforderungsliste steht. Du kannst auch einen
        Screenshot aus der Zwischenablage direkt ins Eingabefeld einfügen.
      </p>
      <ul>
        <li>
          <strong>Fotos:</strong> <code>.png</code>, <code>.jpg</code> und{" "}
          <code>.webp</code>. Grosse Bilder verkleinert dein Browser vor dem
          Senden, das Original bleibt bei dir.
        </li>
        <li>
          <strong>Dateien:</strong> Text, Code und Konfiguration, bis{" "}
          {MAX_TEXT_KB} KB je Datei. Dieselben Formate wie bei den{" "}
          <Link href="/docs/dateien">Dateien im Projekt</Link>, ohne PDFs,
          Word-Dateien und GIFs.
        </li>
        <li>
          Bis zu <strong>{MAX_ATTACHMENTS_PER_MESSAGE} Anhänge</strong> je
          Nachricht. Schreib dazu, was Finn damit tun soll, ein Anhang allein
          lässt sich nicht senden.
        </li>
      </ul>

      <h2>Was sieht Finn von meinen Anhängen?</h2>
      <p>
        Bilder sieht Finn wirklich, mit einem Modell, das Bilder versteht. Bei
        einem <Link href="/docs/eigene-api-keys">eigenen Anbieter</Link> muss
        dein Modell das ebenfalls können, sonst kommt statt einer Antwort ein
        Fehler. Von einer Textdatei liest Finn die ersten{" "}
        {ATTACHMENT_TEXT_CHARS_PER_FILE.toLocaleString("de-CH")} Zeichen. Das
        ist Absicht: die Datei geht bei jeder Antwort erneut mit, und ein langes
        Log würde jede Nachricht verteuern.
      </p>
      <p>
        Die Anhänge bleiben im Chat. Finn sieht sie auch bei späteren Fragen
        wieder, allerdings höchstens die jüngsten {MAX_MODEL_IMAGES} Bilder und
        eine begrenzte Menge Dateitext. Fällt etwas heraus, sagt Finn das, statt
        zu raten, was darauf war. Ein Anhang ist Material, keine Anweisung: Text
        in einer Datei oder auf einem Bild, der wie ein Befehl klingt, wird nur
        gelesen, nicht befolgt.
      </p>

      <h2>Wo liegen meine Anhänge, und wie werde ich sie los?</h2>
      <p>
        In einem privaten Speicher, auf den nur dein Konto Zugriff hat. Zusammen
        dürfen sie höchstens {MAX_STORAGE_MB} MB belegen. Sie verschwinden, wenn
        du den Chat, das Projekt oder dein{" "}
        <Link href="/docs/konto-und-daten">Konto</Link> löschst. Bearbeitest du
        eine Nachricht, bleiben ihre Anhänge dran. Mehr dazu in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>

      <h2>Kann ich den Prompt im selben Chat ändern?</h2>
      <p>
        Ein Chat ist ein Gespräch, kein Formular. Du kannst jederzeit
        nachschieben: „mach es kürzer“, „schreib es förmlicher“, „nimm doch
        Postgres statt Supabase“. Du bekommst jedes Mal den{" "}
        <strong>vollständigen aktualisierten Prompt</strong> zurück, nie nur den
        geänderten Ausschnitt, damit du immer ein Stück Text hast, das du am
        Stück kopieren kannst.
      </p>
      <p>
        Alle Chats bleiben in der Seitenleiste erhalten und lassen sich später
        fortsetzen. Du kannst sie umbenennen und, wenn daraus etwas Grösseres
        wird, in ein <Link href="/docs/projekte">Projekt verschieben</Link>.
      </p>

      <h2>Für welche Aufgaben ist Finn gedacht?</h2>
      <p>
        Für alles, wofür du eine KI einsetzen willst: Texte und Dokumente,
        Webseiten und Apps, Datenbanken, Analysen, Sicherheitsprüfungen,
        Lernpläne. Finn schreibt den Prompt dafür. Die Aufgabe selbst erledigt
        die KI, in die du ihn einfügst.
      </p>

      <h2>Wie breche ich eine Antwort ab?</h2>
      <p>
        Während Finn schreibt, siehst du die Antwort Wort für Wort entstehen.
        Merkst du unterwegs, dass du dich verrannt hast, brich mit dem
        Stopp-Knopf ab. Der bis dahin geschriebene Teil bleibt im Verlauf
        erhalten.
      </p>

      <h2>Was passiert, wenn der KI-Anbieter kurz nicht antwortet?</h2>
      <p>
        Dann versucht PromptPrinter es von selbst bis zu zweimal nochmal, meist
        innerhalb weniger Sekunden. Währenddessen steht im Chat „Das dauert gerade
        etwas länger“. Du musst nichts tun.
      </p>
      <p>
        Klappt es auch beim dritten Versuch nicht, bekommst du eine Meldung und
        kannst die Nachricht erneut senden. Ein gescheiterter Versuch zählt nicht
        gegen dein Kontingent. Hat die Antwort schon zu schreiben begonnen, wird
        nicht von selbst neu angefangen, damit nichts doppelt dasteht.
      </p>
    </DocsShell>
  );
}

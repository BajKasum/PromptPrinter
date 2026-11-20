import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import { docMetadata } from "@/features/marketing/lib/article-metadata";

const doc = docBySlug("ergebnisse")!;

export const metadata: Metadata = docMetadata(doc);

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Prompts speichern"
      intro="Ein Prompt, der funktioniert hat, soll nicht im Chat-Verlauf versanden. Ein Klick legt ihn in deine gespeicherten Prompts."
    >
      <h2>Wie speichere ich einen Prompt?</h2>
      <p>
        Sobald Finn dir einen fertigen Prompt geschrieben hat, sitzt oben in der
        aktuellen Antwort ein <strong>Speichern</strong>-Knopf. Der legt den
        Prompt aus dieser Antwort in deine gespeicherten Prompts.
      </p>
      <p>
        Wichtig zu wissen: <strong>Speichern kostet nichts und ruft kein Modell
        auf.</strong> Es sichert nur den Text, den du ohnehin schon vor dir hast.
        Es zählt deshalb auch nicht als Gratis-Prompt und ist unbegrenzt.
      </p>

      <h2>Wo finde ich gespeicherte Prompts?</h2>
      <p>
        Im Kontomenü unter <strong>Gespeicherte Prompts</strong>, neueste zuerst.
        Die Liste zeigt nur die Titel, ein Klick klappt den Prompt auf. Dort
        kopierst du ihn, benennst ihn um oder löschst ihn.
      </p>
      <p>
        Den Titel musst du beim Speichern nicht vergeben: er entsteht aus der
        ersten Zeile des Prompts. Passt er nicht, änderst du ihn jederzeit.
      </p>

      <h2>Kann ich die Platzhalter eines gespeicherten Prompts ausfüllen?</h2>
      <p>
        Ja. Stehen im Prompt eckige Platzhalter wie <code>[dein Name]</code>, zeigt der aufgeklappte Prompt
        <strong> Platzhalter ausfüllen</strong>, dasselbe Formular wie im Chat. Was du einträgst, bleibt in
        deinem Browser; <strong>Ausgefüllt kopieren</strong> nimmt die ausgefüllte Fassung, gespeichert bleibt
        der Prompt mit seinen Platzhaltern. So wird ein gespeicherter Prompt zur Vorlage, die du immer wieder
        füllst. Das geht auch auf einem geteilten Link.
      </p>

      <h2>Wie baue ich auf einem gespeicherten Prompt auf?</h2>
      <p>
        Mit <strong>Als Ausgangspunkt nutzen</strong>. Das öffnet einen neuen Chat, im Projekt des Prompts oder
        ohne Projekt, und legt den Prompt ins Eingabefeld, darüber die Zeile „Pass diesen Prompt an:“. Du
        schreibst dazu, was sich ändern soll, und schickst es ab, wenn du so weit bist; vorher geht nichts an
        Finn. Der gespeicherte Prompt bleibt, wie er ist, die neue Fassung speicherst du als neuen Prompt. Der
        Weg steht bei jedem Prompt, der samt dieser Zeile in eine Nachricht passt (bis 8000 Zeichen).
      </p>

      <h2>Kann ich einen Prompt in meinen eigenen Code übernehmen?</h2>
      <p>
        Ja, über <strong>Für Entwickler exportieren</strong> am aufgeklappten Prompt. Du wählst das Format und
        die Schnittstelle, die Vorschau zeigt das Ergebnis zum Kopieren:
      </p>
      <ul>
        <li>
          <strong>JSON</strong> als Anfrage an eine OpenAI-kompatible Schnittstelle (dazu gehören Ollama, LM
          Studio, vLLM und OpenRouter), an Anthropic oder an Gemini.
        </li>
        <li>
          <strong>curl, Python und JavaScript</strong> als fertiger Aufruf. Python braucht nur die
          Standardbibliothek, JavaScript läuft als ES-Modul mit Node 18 oder neuer. Für jede andere Sprache
          nimmst du das JSON und schickst es per HTTP.
        </li>
        <li>
          <strong>.prompt.md</strong> als Datei mit YAML-Kopf (Titel, Variablen), für ein Repository in jeder
          Sprache.
        </li>
      </ul>
      <p>
        Leere Platzhalter werden im Export zu Variablen in doppelten geschweiften Klammern, aus{" "}
        <code>[dein Name]</code> wird <code>{"{{dein_name}}"}</code>. Was du im Formular ausgefüllt hast, steht
        direkt im Text. Der API-Key steht nie im Code, nur als Umgebungsvariable, und das Modell steht als{" "}
        <code>MODEL_NAME</code> da, damit du es selbst einsetzt. Auf Wunsch wird der erste Absatz zur
        Systemnachricht; sonst steht der ganze Prompt in einer Nachricht, so wie Finn ihn geschrieben hat.
      </p>

      <h2>Kann ich einen Prompt als PDF exportieren?</h2>
      <p>
        Ja, ein gespeicherter Prompt lässt sich als PDF exportieren, praktisch,
        um ihn weiterzugeben oder in eine Dokumentation zu legen. Kopieren und
        der Markdown-Export gehen genauso.
      </p>

      <h2>Erzeugt Speichern automatisch weitere Dokumente?</h2>
      <p>
        Es entsteht dabei kein Paket aus mehreren Dokumenten, kein Produktplan
        und keine automatisch erzeugte Sammlung. PromptPrinter erzeugt nichts im
        Hintergrund und ohne dein Zutun. Es gibt genau einen Weg zu einem
        gespeicherten Prompt, und den gehst du bewusst: du siehst den Prompt, er
        gefällt dir, du speicherst ihn.
      </p>

      <h2>Kennt Finn meine gespeicherten Prompts?</h2>
      <p>
        Der zuletzt gespeicherte Prompt eines Projekts wird künftigen Chats
        desselben Projekts als Referenz mitgegeben. Das hilft, wenn du an einer
        Sache weiterarbeitest, Finn weiss dann, worauf ihr zuletzt gekommen
        seid, ohne dass du es noch einmal einfügst.
      </p>

      <h2>Kann ich auch ausserhalb eines Projekts speichern?</h2>
      <p>
        Ja. Gespeicherte Prompts gehören zu deinem Konto, nicht zu einem
        Projekt: der Speichern-Knopf sitzt in jedem Chat, auch in einem losen.
        Speicherst du in einem <Link href="/docs/projekte">Projekt</Link>-Chat,
        ordnet PromptPrinter den Prompt zusätzlich diesem Projekt zu. Als
        Markdown-Datei lässt sich jede Antwort ausserdem herunterladen.
      </p>
    </DocsShell>
  );
}

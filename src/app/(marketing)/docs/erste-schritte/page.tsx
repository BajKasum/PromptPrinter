import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";
import { pageMetadata } from "@/shared/lib/page-metadata";

const doc = docBySlug("erste-schritte")!;

export const metadata: Metadata = pageMetadata({
  title: doc.title,
  description: doc.summary,
  path: docHref(doc.slug),
});

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Erste Schritte"
      intro="Vom leeren Konto zum ersten fertigen Prompt sind es drei Schritte. Länger als ein paar Minuten sollte das nicht dauern."
    >
      <h2>1. Konto anlegen</h2>
      <p>
        Auf <Link href="/signup">der Registrierungsseite</Link> meldest du dich mit
        E-Mail und Passwort an (mindestens acht Zeichen) oder direkt über Google
        oder GitHub. Bei der E-Mail-Variante bekommst du eine Bestätigungsmail,
        klick den Link darin, dann bist du drin.
      </p>
      <p>
        Nach der Anmeldung landest du direkt in einem leeren Chat. Kein
        Einrichtungsassistent, keine Fragebögen, es geht sofort los.
      </p>

      <h2>2. Beschreib, was du brauchst</h2>
      <p>
        Schreib in den Chat, was dir vorschwebt, so wie du es einem Kollegen
        erzählen würdest. Ganze Sätze, kein Stichwortstil nötig, und ruhig grob.
        Zwei Beispiele:
      </p>
      <p>
        <em>
          „Ich brauche ein Bewerbungsschreiben für ein Praktikum als Entwickler,
          höchstens eine Seite.“
        </em>
      </p>
      <p>
        <em>
          „Ich will eine App, in der ich meine Kletterrouten festhalte, mit Fotos
          und einer Statistik, wie oft ich welchen Schwierigkeitsgrad geschafft
          habe.“
        </em>
      </p>
      <p>
        Wenn du schon weisst, in welche KI der Prompt am Ende soll, sag es
        gleich dazu, also etwa „für ChatGPT“ oder „für ein Bild-Werkzeug“. Sagst
        du nichts, schreibt Finn den Prompt so, dass er in jeder KI funktioniert.
      </p>

      <h2>3. Beantworte die eine Rückfrage</h2>
      <p>
        Statt sofort loszuschreiben, stellt Finn dir <strong>eine gebündelte
        Rückfrage</strong>, nur zu dem, was für deine Aufgabe zählt: bei einem
        Text zum Beispiel, für wen er ist, in welchem Ton und wie lang, bei einer
        App, welche Seiten es gibt und was gespeichert wird. Das ist genau der
        Durchgang, den eine KI bei einem schnell getippten Prompt selbst nicht
        macht, und der Grund, warum du danach weniger Korrekturrunden brauchst.
      </p>
      <p>
        Antworte in einer Nachricht. Was du nicht weisst, kannst du offen lassen,
        Finn setzt dann eine klar markierte Lücke wie <code>[dein Wert]</code>
        ein, statt sich etwas auszudenken.
      </p>

      <h2>4. Nimm den Prompt mit</h2>
      <p>
        Danach kommt der fertige Prompt in einem Codeblock. Ein Klick auf
        Kopieren, ab damit in die KI deiner Wahl. Passt etwas nicht, sag es einfach im
        Chat, du bekommst den kompletten überarbeiteten Prompt zurück, nicht nur
        das geänderte Stück.
      </p>

      <h2>Wie geht es danach weiter?</h2>
      <p>
        Für einen einzelnen Prompt reicht ein normaler Chat völlig. Sobald du
        länger an derselben Sache arbeitest, lohnt sich ein{" "}
        <Link href="/docs/projekte">Projekt</Link>: dort merkt sich PromptPrinter
        deinen Kontext, statt dass du ihn in jedem neuen Chat wiederholst.
      </p>
    </DocsShell>
  );
}

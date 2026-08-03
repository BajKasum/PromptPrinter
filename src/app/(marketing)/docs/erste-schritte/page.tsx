import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";

const doc = docBySlug("erste-schritte")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

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

      <h2>2. Beschreib, was du bauen willst</h2>
      <p>
        Schreib in den Chat, was dir vorschwebt, so wie du es einem Kollegen
        erzählen würdest. Ganze Sätze, kein Stichwortstil nötig, und ruhig grob:
      </p>
      <p>
        <em>
          „Ich will eine App, in der ich meine Kletterrouten festhalte, mit Fotos
          und einer Statistik, wie oft ich welchen Schwierigkeitsgrad geschafft
          habe.“
        </em>
      </p>
      <p>
        Wenn du schon weisst, in welches Tool der Prompt am Ende soll, sag es
        gleich dazu, also etwa „für Lovable“ oder „ich baue das in Cursor“. Wenn
        nicht, fragt Finn von selbst nach.
      </p>

      <h2>3. Beantworte die eine Rückfrage</h2>
      <p>
        Statt sofort loszuschreiben, stellt Finn dir <strong>eine gebündelte
        Rückfrage</strong>: meist zu Ziel-Tool, den wichtigsten Screens, den
        Daten, die du speicherst, ob es Login geben soll, und in welche
        Design-Richtung es gehen soll. Das ist genau der Durchgang, den ein
        Bau-Tool wie Lovable oder Cursor selbst nie macht, und der Grund, warum
        du danach weniger Korrekturrunden brauchst.
      </p>
      <p>
        Antworte in einer Nachricht. Was du nicht weisst, kannst du offen lassen,
        Finn setzt dann eine klar markierte Lücke wie <code>[dein Wert]</code>
        ein, statt sich etwas auszudenken.
      </p>

      <h2>4. Nimm den Prompt mit</h2>
      <p>
        Danach kommt der fertige Prompt in einem Codeblock. Ein Klick auf
        Kopieren, ab damit in dein Bau-Tool. Passt etwas nicht, sag es einfach im
        Chat, du bekommst den kompletten überarbeiteten Prompt zurück, nicht nur
        das geänderte Stück.
      </p>

      <h2>Und dann?</h2>
      <p>
        Für einen einzelnen Prompt reicht ein normaler Chat völlig. Sobald du
        länger an derselben Sache arbeitest, lohnt sich ein{" "}
        <Link href="/docs/projekte">Projekt</Link>: dort merkt sich PromptPrinter
        deinen Kontext, statt dass du ihn in jedem neuen Chat wiederholst.
      </p>
    </DocsShell>
  );
}

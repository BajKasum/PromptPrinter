import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/lib/docs-nav";

const doc = docBySlug("chat-mit-finn")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Chat mit Finn"
      intro="Finn liefert nicht sofort. Er fragt erst einmal nach, und genau das ist der Punkt."
    >
      <h2>Warum erst eine Rückfrage kommt</h2>
      <p>
        Bau-Tools wie Lovable, Cursor, v0 oder Bolt fangen sofort an zu bauen,
        auch wenn dein Prompt die Hälfte offen lässt. Was fehlt, erfinden sie,
        und du merkst es erst, wenn das Ergebnis danebenliegt. Jede
        Korrekturrunde kostet dich Credits und Zeit.
      </p>
      <p>
        Deshalb macht Finn vorher den Vollständigkeits-Durchgang: eine einzige
        gebündelte Nachricht mit den Punkten, die für <em>deine</em> Idee
        wirklich zählen. Typischerweise:
      </p>
      <ul>
        <li>
          <strong>Ziel-Tool</strong>, falls du es noch nicht gesagt hast
        </li>
        <li>
          <strong>Kern-Screens oder Abläufe</strong>, also was man in der App
          überhaupt tun kann
        </li>
        <li>
          <strong>Datenmodell</strong>, was gespeichert wird und wie die Dinge
          zusammenhängen
        </li>
        <li>
          <strong>Login</strong>, ob es Konten gibt und wie man sich anmeldet
        </li>
        <li>
          <strong>Design-Richtung</strong>, damit nicht der Standard-Look
          herauskommt
        </li>
      </ul>
      <p>
        Was auf deine Idee nicht zutrifft, lässt Finn weg. Die Frage wird nicht
        künstlich auf fünf Punkte aufgefüllt.
      </p>

      <h2>Wie du am schnellsten antwortest</h2>
      <p>
        Alles in eine Nachricht, in beliebiger Reihenfolge, Stichworte reichen.
        Du musst nicht sauber pro Punkt gliedern, Finn sortiert das.
      </p>
      <p>
        Unklarheiten darfst du offen lassen. Schreib ruhig „weiss ich noch
        nicht“, dann setzt Finn an der Stelle eine sichtbare Lücke wie{" "}
        <code>[dein Wert]</code> in den Prompt, statt sich etwas zu erfinden, das
        dann später falsch im Bau-Tool landet.
      </p>

      <h2>Das Ziel-Tool nennen</h2>
      <p>
        Es gibt bewusst kein Auswahlmenü dafür. Du sagst es einfach im Gespräch,
        „für Lovable“, „ich baue in Claude Code“, und der Prompt wird auf die
        Eigenheiten dieses Tools zugeschnitten. Sagst du nichts, fragt Finn.
      </p>

      <h2>Weiterreden statt neu anfangen</h2>
      <p>
        Ein Chat ist ein Gespräch, kein Formular. Du kannst jederzeit
        nachschieben: „mach es kürzer“, „nimm doch Postgres statt Supabase“,
        „ergänze Login mit Google“. Du bekommst jedes Mal den{" "}
        <strong>vollständigen aktualisierten Prompt</strong> zurück, nie nur den
        geänderten Ausschnitt, damit du immer ein Stück Text hast, das du am
        Stück kopieren kannst.
      </p>
      <p>
        Alle Chats bleiben in der Seitenleiste erhalten und lassen sich später
        fortsetzen. Du kannst sie umbenennen und, wenn daraus etwas Grösseres
        wird, in ein <Link href="/docs/projekte">Projekt verschieben</Link>.
      </p>

      <h2>Wenn es kein Software-Projekt ist</h2>
      <p>
        Finn ist auf Bau-Tools ausgerichtet, aber nicht stur. Fragst du nach
        etwas anderem, hilft er trotzdem, ohne dir Datenmodell- und
        Login-Fragen aufzuzwingen, die keinen Sinn ergeben.
      </p>

      <h2>Antwort abbrechen</h2>
      <p>
        Während Finn schreibt, siehst du die Antwort Wort für Wort entstehen.
        Merkst du unterwegs, dass du dich verrannt hast, brich mit dem
        Stopp-Knopf ab. Der bis dahin geschriebene Teil bleibt im Verlauf
        erhalten.
      </p>
    </DocsShell>
  );
}

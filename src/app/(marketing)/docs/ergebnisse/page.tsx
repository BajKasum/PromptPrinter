import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug, docHref } from "@/shared/lib/docs-nav";
import { pageMetadata } from "@/shared/lib/page-metadata";

const doc = docBySlug("ergebnisse")!;

export const metadata: Metadata = pageMetadata({
  title: doc.title,
  description: doc.summary,
  path: docHref(doc.slug),
});

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
        Es zählt deshalb auch nicht gegen dein monatliches Nachrichtenkontingent
        und ist in jedem Plan unbegrenzt.
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

      <h2>Kann ich einen Prompt als PDF exportieren?</h2>
      <p>
        Mit Pro lässt sich ein gespeicherter Prompt zusätzlich als PDF
        exportieren, praktisch, um ihn weiterzugeben oder in eine Dokumentation
        zu legen. Kopieren und der Markdown-Export sind in jedem Plan dabei.
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

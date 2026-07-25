import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/components/marketing/docs-shell";
import { docBySlug } from "@/lib/docs-nav";

const doc = docBySlug("ergebnisse")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Prompts speichern"
      intro="Ein Prompt, der funktioniert hat, soll nicht im Chat-Verlauf versanden. Ein Klick legt ihn in die Ergebnisse des Projekts."
    >
      <h2>Speichern</h2>
      <p>
        In einem Projekt-Chat sitzt unter der aktuellen Antwort ein{" "}
        <strong>Speichern</strong>-Knopf. Der legt den fertigen Prompt aus dieser
        Antwort in die Ergebnisse des Projekts.
      </p>
      <p>
        Wichtig zu wissen: <strong>Speichern kostet nichts und ruft kein Modell
        auf.</strong> Es sichert nur den Text, den du ohnehin schon vor dir hast.
        Es zählt deshalb auch nicht gegen dein monatliches Nachrichtenkontingent
        und ist in jedem Plan unbegrenzt.
      </p>

      <h2>Wiederfinden</h2>
      <p>
        Im Projekt führt der Reiter <strong>Ergebnisse</strong> zur Liste aller
        gespeicherten Prompts, neueste zuerst, jeweils mit Titel und, falls
        bekannt, dem Ziel-Tool. Von dort kannst du jeden Eintrag kopieren oder
        wieder löschen.
      </p>

      <h2>Export als PDF</h2>
      <p>
        Mit Pro lässt sich ein gespeicherter Prompt zusätzlich als PDF
        exportieren, praktisch, um ihn weiterzugeben oder in eine Dokumentation
        zu legen. Kopieren und der Markdown-Export sind in jedem Plan dabei.
      </p>

      <h2>Was Speichern nicht ist</h2>
      <p>
        Es entsteht dabei kein Paket aus mehreren Dokumenten, kein Produktplan
        und keine automatisch erzeugte Sammlung. PromptPrinter erzeugt nichts im
        Hintergrund und ohne dein Zutun. Es gibt genau einen Weg zu einem
        Ergebnis, und den gehst du bewusst: du siehst den Prompt, er gefällt
        dir, du speicherst ihn.
      </p>

      <h2>Gespeicherte Prompts als Kontext</h2>
      <p>
        Der zuletzt gespeicherte Prompt eines Projekts wird künftigen Chats
        desselben Projekts als Referenz mitgegeben. Das hilft, wenn du an einer
        Sache weiterarbeitest, Finn weiss dann, worauf ihr zuletzt gekommen
        seid, ohne dass du es noch einmal einfügst.
      </p>

      <h2>Nur in Projekten</h2>
      <p>
        Ergebnisse hängen immer an einem Projekt, in einem losen Chat gibt es
        den Speichern-Knopf nicht. Wenn du in einem normalen Chat etwas Gutes
        hast, das du behalten willst, verschieb den Chat zuerst in ein{" "}
        <Link href="/docs/projekte">Projekt</Link>, oder lade die Antwort als
        Markdown herunter.
      </p>
    </DocsShell>
  );
}

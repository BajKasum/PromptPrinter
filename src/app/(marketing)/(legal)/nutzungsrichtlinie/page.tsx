import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";
import { LEGAL } from "@/shared/lib/legal";
import { pageMetadata } from "@/shared/lib/page-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Nutzungsrichtlinie",
  description:
    "Was du mit PromptPrinter tun darfst und was nicht: verbotene Inhalte, verbotene Nutzung, Folgen von Verstössen und wie du etwas meldest.",
  path: "/nutzungsrichtlinie",
});

// Ergänzt Ziffer 7 der AGB ("Pflichten der Nutzer"), die nur eine kurze Liste
// trug. Die AGB verweisen auf diese Seite und machen sie zu ihrem Bestandteil,
// die Einwilligung bei der Registrierung deckt sie also mit ab.
//
// Wie bei den anderen Rechtstexten gilt: beschrieben wird nur, was der Dienst
// tatsächlich tut. Es gibt keine automatische Inhaltsprüfung, also verspricht
// diese Seite auch keine; die Schutzfilter der Modellanbieter gibt es
// dagegen wirklich (sie lehnen Anfragen selbst ab).
export default function NutzungsrichtliniePage() {
  return (
    <LegalShell
      badge="Rechtliches"
      title="Nutzungsrichtlinie"
      intro="Was du mit PromptPrinter tun darfst und was nicht. Sie ergänzt die AGB und gilt für jeden Plan, auch mit eigenem API-Key."
      updated={LEGAL.lastUpdated}
    >
      <h2>1. Wofür diese Richtlinie gilt</h2>
      <p>
        Diese Nutzungsrichtlinie ist Bestandteil unserer <a href="/agb">AGB</a> und konkretisiert
        deren Ziffer 7. Sie gilt für alles, was du über PromptPrinter eingibst, hochlädst oder
        erzeugen lässt: Chats, Projekte, Projektdateien, ein verknüpftes GitHub-Repository und
        gespeicherte Prompts.
      </p>
      <p>
        Sie gilt unabhängig von deinem Plan. Laufen deine Anfragen über deinen eigenen API-Key,
        gelten <strong>zusätzlich die Nutzungsrichtlinien deines Modellanbieters</strong>.
      </p>

      <h2>2. Wofür PromptPrinter gedacht ist</h2>
      <p>
        PromptPrinter hilft dir, aus einer Idee einen klaren Prompt für KI-Bau-Tools wie Lovable,
        Cursor oder Claude Code zu machen, und dein Projektwissen dafür bereitzuhalten. Die
        Ergebnisse darfst du nach Ziffer 5 der AGB frei für eigene Zwecke verwenden, auch in
        kommerziellen Projekten. Die Grenzen unten betreffen nicht das Bauen selbst, sondern
        Inhalte und Verhalten, die anderen schaden oder den Dienst gefährden.
      </p>

      <h2>3. Verbotene Inhalte</h2>
      <p>Du gibst nichts ein, lädst nichts hoch und lässt nichts erzeugen, das</p>
      <ul>
        <li>rechtswidrig ist oder zu einer Straftat anleitet;</li>
        <li>Kinder sexualisiert oder ausbeutet, in welcher Form auch immer;</li>
        <li>
          zu Gewalt oder Terror aufruft, Gewalt verherrlicht oder Menschen wegen Herkunft,
          Religion, Geschlecht, sexueller Orientierung, Behinderung oder ähnlicher Merkmale
          herabsetzt;
        </li>
        <li>
          andere belästigt, bedroht oder blossstellt, etwa indem persönliche Daten Dritter ohne
          deren Einwilligung gesammelt oder veröffentlicht werden;
        </li>
        <li>
          Urheber-, Marken- oder andere Rechte Dritter verletzt, zum Beispiel fremden Code, dessen
          Lizenz diese Nutzung nicht erlaubt;
        </li>
        <li>
          Schadsoftware, Phishing-Seiten, Betrugsmaschen oder Werkzeuge für das unbefugte
          Eindringen in fremde Systeme herstellt oder verbreitet;
        </li>
        <li>
          Anleitungen zur Herstellung von Waffen liefert, die viele Menschen verletzen können,
          insbesondere chemische, biologische, radiologische oder nukleare;
        </li>
        <li>
          andere gezielt täuschen soll, etwa durch das Nachahmen echter Personen oder Firmen oder
          durch gefälschte Bewertungen.
        </li>
      </ul>
      <p>
        Wer an einem Projekt zu Sicherheit, Moderation oder Jugendschutz arbeitet, darf über diese
        Themen selbstverständlich sprechen. Verboten ist, solche Inhalte herzustellen oder damit
        Schaden anzurichten, nicht, sie zu verhindern.
      </p>

      <h2>4. Verbotene Nutzung des Dienstes</h2>
      <p>Ebenso unterlässt du es,</p>
      <ul>
        <li>
          Schutz- und Begrenzungsmassnahmen zu umgehen, etwa Rate-Limits, Monatskontingente oder
          das Captcha, zum Beispiel mit mehreren Konten;
        </li>
        <li>
          den Dienst automatisiert zu nutzen (Skripte, Bots, Scraping), ausser über die normale
          Oberfläche, oder in einem Umfang, der den Betrieb beeinträchtigt;
        </li>
        <li>
          zu versuchen, an Daten anderer Nutzer, an interne Anweisungen oder an Zugangsschlüssel
          des Dienstes zu gelangen, auch über präparierte Eingaben an die KI (Prompt-Injection);
        </li>
        <li>
          Sicherheitslücken auszunutzen oder den Dienst ohne vorherige Absprache auf Lücken zu
          testen, etwa durch Last- oder Angriffstests;
        </li>
        <li>
          dein Konto mit anderen zu teilen, den Zugang weiterzuverkaufen oder den Dienst als
          Schnittstelle für Dritte anzubieten;
        </li>
        <li>
          den Dienst zu nutzen, um ein konkurrierendes Produkt aufzubauen oder Modelle zu
          trainieren;
        </li>
        <li>ein Konto mit falschen Angaben anzulegen oder dich als eine andere Person auszugeben.</li>
      </ul>

      <h2>5. Deine Verantwortung für Eingaben und Ergebnisse</h2>
      <p>
        KI kann sich irren (siehe Ziffer 6 der <a href="/agb">AGB</a>). Prüfe erzeugte Prompts und
        den Code, der daraus entsteht, bevor du ihn einsetzt, vor allem wenn es um Sicherheit,
        Zahlungen oder persönliche Daten anderer geht.
      </p>
      <p>
        Gib <strong>keine Passwörter, Zugangsdaten oder geheimen Schlüssel</strong> in Chats oder
        Projektdateien ein. Für deinen eigenen API-Key gibt es in den Einstellungen ein eigenes
        Feld, das ihn verschlüsselt speichert. Personenbezogene Daten Dritter gibst du nur ein, wenn
        du das darfst.
      </p>

      <h2>6. Was bei Verstössen passiert</h2>
      <p>
        Wir prüfen deine Inhalte nicht laufend und automatisch. Die Modellanbieter setzen aber
        eigene Schutzfilter ein und können einzelne Anfragen ablehnen. Erfahren wir von einem
        Verstoss, etwa durch eine Meldung, können wir je nach Schwere
      </p>
      <ul>
        <li>die betroffenen Inhalte entfernen,</li>
        <li>einzelne Funktionen für dein Konto einschränken oder</li>
        <li>
          dein Konto vorübergehend oder dauerhaft sperren (Ziffer 15 der <a href="/agb">AGB</a>).
        </li>
      </ul>
      <p>
        Wo es angemessen ist, benachrichtigen wir dich vorher. Bei schweren Verstössen, insbesondere bei Inhalten, die Kinder ausbeuten,
        informieren wir die zuständigen Behörden, soweit das Gesetz es vorsieht oder erlaubt.
      </p>

      <h2>7. Verstösse und Sicherheitslücken melden</h2>
      <p>
        Wenn du einen Verstoss gegen diese Richtlinie oder eine Sicherheitslücke bemerkst, schreib
        uns an <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> oder über die{" "}
        <a href="/kontakt">Kontaktseite</a>. Eine gefundene Lücke nutzt du bitte nicht aus und
        machst sie erst öffentlich, wenn wir Zeit hatten, sie zu beheben.
      </p>

      <h2>8. Änderungen dieser Richtlinie</h2>
      <p>
        Wir können diese Richtlinie anpassen, etwa wenn neue Funktionen dazukommen oder sich die
        Rechtslage ändert. Es gilt Ziffer 16 der <a href="/agb">AGB</a>: Über wesentliche
        Änderungen informieren wir in geeigneter Form, die jeweils aktuelle Fassung steht auf
        dieser Seite.
      </p>
    </LegalShell>
  );
}

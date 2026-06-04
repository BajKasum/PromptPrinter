import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "AGB",
  description: "Allgemeine Geschäftsbedingungen für die Nutzung von PromptPrinter.",
};

export default function AgbPage() {
  return (
    <LegalShell
      badge="Rechtliches"
      title="Allgemeine Geschäftsbedingungen"
      intro="Die Bedingungen für die Nutzung von PromptPrinter — kurz gehalten und in verständlicher Sprache."
      updated={LEGAL.lastUpdated}
    >
      <h2>1. Geltungsbereich und Anbieter</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung des Dienstes PromptPrinter
        (nachfolgend „Dienst“), angeboten von {LEGAL.operator}, {LEGAL.postalCity}, {LEGAL.country}.
        Mit der Registrierung oder Nutzung des Dienstes akzeptierst du diese AGB.
      </p>

      <h2>2. Leistungsbeschreibung</h2>
      <p>
        Der Dienst erzeugt aus deinen Eingaben (Idee, Zielgruppe, Tool-Auswahl) mithilfe von
        Künstlicher Intelligenz strukturierte Prompt-Artefakte wie Brief, PRD, Master-Prompt,
        Frontend- und Backend-Prompts, Datenbankschema sowie weitere Bausteine. Der Dienst befindet
        sich in einer <strong>Beta-Phase</strong>; Funktionsumfang und Verfügbarkeit können sich
        ändern.
      </p>

      <h2>3. Registrierung und Konto</h2>
      <p>
        Für die Nutzung ist ein Konto erforderlich. Du musst mindestens 16 Jahre alt sein oder die
        Zustimmung deiner gesetzlichen Vertretung haben. Du machst bei der Registrierung
        wahrheitsgemässe Angaben und hältst deine Zugangsdaten geheim. Für Handlungen über dein Konto
        bist du verantwortlich.
      </p>

      <h2>4. Nutzung der Ergebnisse</h2>
      <p>
        Die generierten Artefakte darfst du für eigene Zwecke frei verwenden. Du bist allein dafür
        verantwortlich, wie du die Ergebnisse einsetzt — insbesondere für die Prüfung auf rechtliche
        Zulässigkeit, Richtigkeit und Eignung für deinen konkreten Anwendungsfall.
      </p>

      <h2>5. Pflichten der Nutzer</h2>
      <p>Du verpflichtest dich, den Dienst nicht zu missbrauchen. Insbesondere unterlässt du es,</p>
      <ul>
        <li>rechtswidrige, rechteverletzende oder beleidigende Inhalte einzugeben;</li>
        <li>technische Schutz- oder Begrenzungsmassnahmen (z. B. Rate-Limits) zu umgehen;</li>
        <li>den Dienst automatisiert in einem Umfang zu nutzen, der den Betrieb beeinträchtigt;</li>
        <li>Rechte Dritter oder geltendes Recht zu verletzen.</li>
      </ul>

      <h2>6. KI-generierte Inhalte — keine Gewähr</h2>
      <p>
        Die Ergebnisse werden automatisiert durch KI-Modelle erzeugt und können{" "}
        <strong>Fehler, Ungenauigkeiten oder unpassende Inhalte</strong> enthalten. Wir übernehmen
        keine Gewähr für Richtigkeit, Vollständigkeit oder Eignung der Ergebnisse für einen bestimmten
        Zweck. Eine eigenverantwortliche Prüfung vor dem Einsatz ist erforderlich.
      </p>

      <h2>7. Verfügbarkeit</h2>
      <p>
        Wir bemühen uns um eine möglichst hohe Verfügbarkeit, schulden jedoch keinen
        unterbrechungsfreien Betrieb. Wartungsarbeiten, Störungen oder Anpassungen können zu
        zeitweiligen Einschränkungen führen.
      </p>

      <h2>8. Preise</h2>
      <p>
        Der Dienst wird derzeit kostenlos angeboten. Kostenpflichtige Pläne können künftig eingeführt
        werden; in diesem Fall werden die Konditionen vor einer Bezahlung transparent ausgewiesen und
        gesondert vereinbart.
      </p>

      <h2>9. Haftung</h2>
      <p>
        Wir haften für Schäden nur bei Vorsatz oder grober Fahrlässigkeit sowie bei der Verletzung
        wesentlicher Vertragspflichten. Im Übrigen ist die Haftung – soweit gesetzlich zulässig –
        ausgeschlossen. Für mittelbare Schäden und Folgeschäden wird nicht gehaftet.
      </p>

      <h2>10. Kündigung</h2>
      <p>
        Du kannst dein Konto jederzeit über die Einstellungen löschen. Wir können Konten bei
        Verstössen gegen diese AGB sperren oder löschen. Informationen zur Datenlöschung findest du
        in unserer <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>

      <h2>11. Änderungen dieser AGB</h2>
      <p>
        Wir können diese AGB anpassen, etwa bei Änderungen des Funktionsumfangs oder der Rechtslage.
        Über wesentliche Änderungen informieren wir in geeigneter Form. Die jeweils aktuelle Fassung
        ist auf dieser Seite abrufbar.
      </p>

      <h2>12. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt schweizerisches Recht unter Ausschluss der Kollisionsnormen. Soweit gesetzlich
        zulässig, ist Gerichtsstand {LEGAL.jurisdiction}. Zwingende Verbraucherschutzbestimmungen
        deines Wohnsitzstaates bleiben unberührt.
      </p>

      <h2>13. Kontakt</h2>
      <p>
        Bei Fragen zu diesen AGB erreichst du uns unter{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalShell>
  );
}

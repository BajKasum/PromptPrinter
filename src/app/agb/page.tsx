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
      intro="Die Bedingungen für die Nutzung von PromptPrinter, kurz gehalten und in verständlicher Sprache."
      updated={LEGAL.lastUpdated}
    >
      <h2>1. Geltungsbereich und Anbieter</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung des Dienstes PromptPrinter
        (nachfolgend „Dienst“), angeboten von {LEGAL.operator}, {LEGAL.postalCity}, {LEGAL.country}.
        Mit der Registrierung oder Nutzung des Dienstes akzeptierst du diese AGB. Die vollständigen
        Anbieterangaben findest du im <a href="/impressum">Impressum</a>.
      </p>

      <h2>2. Leistungsbeschreibung</h2>
      <p>
        Der Dienst bietet einen KI-gestützten Chat mit Finn, der dich beim Formulieren,
        Strukturieren und Verfeinern von Prompts für andere KI-Tools (z. B. Claude, ChatGPT,
        Lovable, Cursor) unterstützt. Dazu kommen Projekte als Arbeitsbereiche mit eigenem Kontext,
        das Anhängen von Textdateien und das Speichern fertiger Prompts.
      </p>
      <p>
        Der Dienst befindet sich in einer <strong>Beta-Phase</strong>. Funktionsumfang, Grenzen und
        Verfügbarkeit können sich ändern, einzelne Funktionen können hinzukommen oder entfallen.
      </p>

      <h2>3. Registrierung und Konto</h2>
      <p>
        Für die Nutzung ist ein Konto erforderlich. Du musst mindestens 16 Jahre alt sein oder die
        Zustimmung deiner gesetzlichen Vertretung haben. Du machst bei der Registrierung
        wahrheitsgemässe Angaben und hältst deine Zugangsdaten geheim. Für Handlungen über dein Konto
        bist du verantwortlich. Wenn du den Verdacht hast, dass dein Konto unbefugt genutzt wird,
        informiere uns bitte umgehend.
      </p>

      <h2>4. Deine Inhalte</h2>
      <p>
        Was du eingibst oder hochlädst, bleibt deins. Du räumst uns lediglich das Recht ein, diese
        Inhalte zu speichern, zu verarbeiten und anzuzeigen, soweit das nötig ist, um den Dienst für
        dich zu betreiben. Dazu gehört die Übermittlung an die eingesetzten Modellanbieter, um
        überhaupt eine Antwort erzeugen zu können, siehe <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>
      <p>
        Du sicherst zu, dass du die nötigen Rechte an dem hast, was du eingibst oder hochlädst, und
        dass es keine Rechte Dritter verletzt. Wir werten deine Inhalte nicht aus, um damit Modelle
        zu trainieren.
      </p>

      <h2>5. Nutzung der Ergebnisse</h2>
      <p>
        Die Inhalte, die du über den Dienst erhältst, darfst du für eigene Zwecke frei verwenden. Du
        bist allein dafür verantwortlich, wie du sie einsetzt, insbesondere für die Prüfung auf
        rechtliche Zulässigkeit, Richtigkeit und Eignung für deinen konkreten Anwendungsfall.
      </p>

      <h2>6. KI-generierte Inhalte: keine Gewähr</h2>
      <p>
        Die Ergebnisse werden automatisiert durch KI-Modelle erzeugt und können{" "}
        <strong>Fehler, Ungenauigkeiten oder unpassende Inhalte</strong> enthalten. Sie sind eine
        Arbeitshilfe und keine fachliche, rechtliche oder sonstige Beratung. Wir übernehmen keine
        Gewähr für Richtigkeit, Vollständigkeit oder Eignung der Ergebnisse für einen bestimmten
        Zweck. Eine eigenverantwortliche Prüfung vor dem Einsatz ist erforderlich.
      </p>
      <p>
        Gleiche Eingaben können zu unterschiedlichen Ergebnissen führen. Ein Anspruch auf ein
        bestimmtes Ergebnis besteht nicht.
      </p>

      <h2>7. Pflichten der Nutzer</h2>
      <p>Du verpflichtest dich, den Dienst nicht zu missbrauchen. Insbesondere unterlässt du es,</p>
      <ul>
        <li>rechtswidrige, rechteverletzende oder beleidigende Inhalte einzugeben;</li>
        <li>technische Schutz- oder Begrenzungsmassnahmen (z. B. Rate-Limits) zu umgehen;</li>
        <li>den Dienst automatisiert in einem Umfang zu nutzen, der den Betrieb beeinträchtigt;</li>
        <li>auf Konten, Daten oder Systeme zuzugreifen, die dir nicht gehören;</li>
        <li>
          den Dienst zu nutzen, um ein konkurrierendes Produkt aufzubauen oder Modelle zu trainieren;
        </li>
        <li>Rechte Dritter oder geltendes Recht zu verletzen.</li>
      </ul>

      <h2>8. Nutzungsgrenzen</h2>
      <p>
        Der Dienst enthält mengenmässige Grenzen, etwa für Chat-Antworten pro Monat und für die Zahl
        der Projekte, sowie einen stündlichen Missbrauchsschutz. Diese Grenzen halten den Betrieb
        bezahlbar und stabil. Die jeweils geltenden Werte sind in der{" "}
        <a href="/docs/plaene-und-limits">Hilfe</a> dokumentiert und können angepasst werden; sie
        werden nicht eingesetzt, um einzelne Nutzer zu benachteiligen.
      </p>

      <h2>9. Eigene API-Keys</h2>
      <p>
        Du kannst einen eigenen Zugang zu einem Modellanbieter hinterlegen. Dann laufen deine
        Anfragen über dein Konto bei diesem Anbieter, und das monatliche Nachrichtenlimit entfällt.
      </p>
      <p>
        In diesem Fall gelten <strong>zusätzlich die Bedingungen und Preise deines Anbieters</strong>,
        und die dort anfallenden Kosten trägst du selbst. Wir haben darauf keinen Einfluss und keinen
        Zugriff. Hinterlegte Keys werden verschlüsselt gespeichert; du bist dafür verantwortlich, sie
        bei deinem Anbieter zu widerrufen, wenn du sie hier entfernst.
      </p>

      <h2>10. Pläne, Preise und Zahlung</h2>
      <p>
        Es gibt einen kostenlosen Plan und einen kostenpflichtigen Pro-Plan. Der kostenlose Plan ist
        dauerhaft nutzbar, insbesondere in Verbindung mit einem eigenen API-Key.
      </p>
      <p>
        <strong>Stand heute ist der Pro-Plan noch nicht freigeschaltet</strong>, es sind über den
        Dienst derzeit keine Zahlungen möglich. Sobald das der Fall ist, gilt:
      </p>
      <ul>
        <li>
          Die jeweils gültigen Preise werden vor dem Kauf auf der <a href="/pricing">Preisseite</a>{" "}
          ausgewiesen.
        </li>
        <li>
          Abonnements verlängern sich automatisch um den jeweiligen Abrechnungszeitraum, bis sie
          gekündigt werden. Du kannst jederzeit kündigen und behältst den Zugang bis zum Ende des
          bezahlten Zeitraums.
        </li>
        <li>
          Für die Erstattung gilt unsere <a href="/rueckerstattung">Rückerstattungsrichtlinie</a>,
          einschliesslich einer 14-tägigen Geld-zurück-Garantie auf die erste Zahlung.
        </li>
        <li>
          Der Verkauf wird über einen externen Zahlungsdienstleister abgewickelt, der zugleich
          Vertragspartner für den Kauf ist und die Abrechnung samt Steuern übernimmt. Für die
          Transaktion gelten dann ergänzend dessen Bedingungen.
        </li>
        <li>
          Preise und Leistungsumfang können geändert werden. Änderungen an einem laufenden
          Abonnement kündigen wir vorher an; sie gelten ab dem nächsten Abrechnungszeitraum.
        </li>
      </ul>

      <h2>11. Drittdienste</h2>
      <p>
        Der Dienst greift auf Dritte zurück, insbesondere auf Modellanbieter für die Erzeugung der
        Antworten, auf Supabase für Konto, Datenbank und Dateispeicher, auf die Anmeldung über
        Google oder GitHub sowie auf den Hosting-Anbieter. Wer das im Einzelnen ist und welche Daten
        dorthin gelangen, steht in der <a href="/datenschutz">Datenschutzerklärung</a>. Für Dienste,
        die wir nicht kontrollieren, übernehmen wir keine Verantwortung.
      </p>

      <h2>12. Verfügbarkeit</h2>
      <p>
        Wir bemühen uns um eine möglichst hohe Verfügbarkeit, schulden jedoch keinen
        unterbrechungsfreien Betrieb. Wartungsarbeiten, Störungen oder Anpassungen können zu
        zeitweiligen Einschränkungen führen. Der Dienst wird als Solo-Projekt betrieben, es gibt
        keine zugesicherte Reaktionszeit und keine Rufbereitschaft.
      </p>

      <h2>13. Geistiges Eigentum</h2>
      <p>
        Der Dienst selbst, einschliesslich Software, Gestaltung, Marke und Maskottchen, steht dem
        Anbieter zu und ist rechtlich geschützt. Diese AGB verschaffen dir daran keine Rechte,
        abgesehen vom Recht, den Dienst bestimmungsgemäss zu nutzen. Deine eigenen Inhalte bleiben
        davon unberührt, siehe Ziffer 4.
      </p>

      <h2>14. Haftung</h2>
      <p>
        Wir haften für Schäden nur bei Vorsatz oder grober Fahrlässigkeit sowie bei der Verletzung
        wesentlicher Vertragspflichten. Im Übrigen ist die Haftung (soweit gesetzlich zulässig)
        ausgeschlossen. Für mittelbare Schäden, Folgeschäden sowie für Datenverlust wird nicht
        gehaftet; bewahre wichtige Inhalte deshalb zusätzlich selbst auf. Eine Haftung, die
        gesetzlich nicht beschränkt werden kann, bleibt unberührt.
      </p>

      <h2>15. Sperrung und Kündigung</h2>
      <p>
        Du kannst dein Konto jederzeit über die Einstellungen löschen. Wir können Konten bei
        Verstössen gegen diese AGB oder zum Schutz des Dienstes sperren oder löschen, wo angemessen
        mit vorheriger Benachrichtigung. Nach einer Löschung ist der Zugriff auf deine Inhalte
        nicht mehr möglich. Informationen zur Datenlöschung findest du in unserer{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>. Bestimmungen, die ihrer Natur nach
        fortgelten sollen, etwa zu geistigem Eigentum und Haftung, gelten weiter.
      </p>

      <h2>16. Änderungen dieser AGB</h2>
      <p>
        Wir können diese AGB anpassen, etwa bei Änderungen des Funktionsumfangs oder der Rechtslage.
        Über wesentliche Änderungen informieren wir in geeigneter Form. Die jeweils aktuelle Fassung
        ist auf dieser Seite abrufbar. Nutzt du den Dienst nach Inkrafttreten weiter, gilt das als
        Zustimmung.
      </p>

      <h2>17. Anwendbares Recht und Gerichtsstand</h2>
      <p>
        Es gilt schweizerisches Recht unter Ausschluss der Kollisionsnormen. Soweit gesetzlich
        zulässig, ist Gerichtsstand {LEGAL.jurisdiction}. Zwingende Verbraucherschutzbestimmungen
        deines Wohnsitzstaates bleiben unberührt.
      </p>

      <h2>18. Kontakt</h2>
      <p>
        Bei Fragen zu diesen AGB erreichst du uns unter{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> oder über die{" "}
        <a href="/kontakt">Kontaktseite</a>.
      </p>
    </LegalShell>
  );
}

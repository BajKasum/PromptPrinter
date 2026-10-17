// Ziffer 5 der Datenschutzerklaerung, Uebermittlung in Drittlaender. Aus der Seite ausgelagert,
// damit sie unter der Dateigrenze von 400 Zeilen bleibt (tests/guards/file-size.test.ts).
// Der Text ist unveraendert; LEGAL.appHost kommt wie auf der Seite aus shared/lib/legal.ts.
import { LEGAL } from "@/shared/lib/legal";

export function DatenschutzDrittlaender() {
  return (
    <>
      <h2>5. Übermittlung in Drittländer</h2>
      <p>
        Einzelne der oben genannten Dienste bearbeiten Daten ausserhalb der Schweiz bzw. des EWR,
        namentlich in den <strong>USA</strong> ({LEGAL.appHost}, Cloudflare, Resend,
        Lemon Squeezy, gegebenenfalls der von dir gewählte eigene Anbieter, bei der Anmeldung über
        diese Dienste Google bzw. GitHub sowie, wenn du den Sprachmodus mit Chrome oder Edge
        nutzt, Google bzw. Microsoft, siehe Ziffer 4) sowie in <strong>Singapur</strong> (Z.ai,
        möglicherweise auch in <strong>China</strong>). Bei Supabase (Vertragspartner in
        Singapur) und Upstash (Anbieter mit Sitz in den USA) liegen die Daten in der EU, in Irland
        bzw. Frankfurt; soweit die Anbieter von ausserhalb darauf zugreifen, gelten die
        Standardvertragsklauseln in ihren Vereinbarungen.
      </p>
      <p>
        Für Übermittlungen an Dienstleister in den USA, die in unserem Auftrag handeln, stützen wir
        uns auf die Standardvertragsklauseln der EU-Kommission in deren
        Auftragsbearbeitungsvereinbarungen und, soweit der jeweilige Anbieter entsprechend
        zertifiziert ist, ergänzend auf das EU-US bzw. Swiss-US Data Privacy Framework. Anbieter,
        die in eigener Verantwortung handeln (Ziffer 4), bestimmen die Grundlage ihrer
        Übermittlungen selbst. Auch für Supabase gelten die Standardvertragsklauseln der
        EU-Kommission in dessen Vereinbarung zur Auftragsbearbeitung, die dort für Übermittlungen
        aus der Schweiz angepasst sind.
      </p>
      <p>
        Für Singapur und China besteht weder ein Angemessenheitsbeschluss der EU-Kommission noch
        eine Anerkennung durch den Schweizer Bundesrat. Z.ai verpflichtet sich in seiner
        Vereinbarung zur Auftragsbearbeitung für API-Kunden, Daten nur nach unseren Weisungen zu
        bearbeiten, und nach eigenen Angaben, Daten nur gestützt auf gesetzlich anerkannte
        Mechanismen ins Ausland zu übermitteln. Ein gleichwertiges Datenschutzniveau können wir für
        diese Länder dennoch nicht vollständig zusichern. Deshalb holen wir im Pro-Plan, bevor deine
        Nachrichten zum ersten Mal an Z.ai gehen, deine <strong>ausdrückliche Einwilligung</strong>
        ein (Art. 49 Abs. 1 lit. a DSGVO; Art. 17 Abs. 1 lit. a revDSG), und der Server prüft sie bei
        jeder Anfrage; das gilt auch für die Analyse im Projekt-Gedächtnis. Du kannst sie jederzeit
        in den Einstellungen widerrufen, danach antwortet Finn nur noch mit deinem eigenen
        API-Schlüssel. Wenn du das vermeiden möchtest, kannst du in den
        Einstellungen einen eigenen API-Schlüssel eines Anbieters deiner Wahl hinterlegen; deine
        Eingaben gehen dann nicht mehr an Z.ai.
      </p>
    </>
  );
}

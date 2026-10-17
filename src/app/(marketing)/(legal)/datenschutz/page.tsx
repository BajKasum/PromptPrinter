import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";
import { DatenschutzWeitereEmpfaenger } from "@/features/marketing/components/datenschutz-weitere-empfaenger";
import { LEGAL } from "@/shared/lib/legal";
import {
  MAX_FILES_PER_PROJECT,
  MAX_PROJECT_FILE_BYTES,
} from "@/features/projects/lib/project-files";
import { pageMetadata } from "@/shared/lib/page-metadata";
import {
  MAX_ATTACHMENT_STORAGE_PER_USER,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/shared/lib/chat-limits";

// Die Dateigrenzen kommen aus project-files.ts, derselben Quelle, die Upload
// und Migration 0038 durchsetzen. Bis 28.09.2026 stand hier von Hand
// ".md, .txt, .json, .csv", obwohl seit dem Projekt-Gedaechtnis auch Code,
// Konfiguration und Bilder erlaubt sind.
const MAX_PROJECT_MB = Math.round(MAX_PROJECT_FILE_BYTES / (1024 * 1024));
// Dasselbe fuer die Anhaenge einer Chat-Nachricht: die Zahlen stehen in
// chat-limits.ts, derselben Quelle, die der Composer und die Route durchsetzen.
const MAX_ATTACHMENT_STORAGE_MB = Math.round(MAX_ATTACHMENT_STORAGE_PER_USER / (1024 * 1024));

export const metadata: Metadata = pageMetadata({
  title: "Datenschutz",
  description:
    "Wie PromptPrinter deine Personendaten bearbeitet: Konto, Eingaben, KI-Verarbeitung und deine Rechte.",
  path: "/datenschutz",
});

export default function DatenschutzPage() {
  return (
    <LegalShell
      badge="Rechtliches"
      title="Datenschutzerklärung"
      intro="Wir bearbeiten nur die Daten, die für den Betrieb von PromptPrinter nötig sind, und legen offen, an wen sie weitergegeben werden."
      updated={LEGAL.lastUpdated}
    >
      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Bearbeitung deiner Personendaten im Sinne des Schweizer
        Datenschutzgesetzes (revDSG) und (soweit anwendbar) der EU-Datenschutz-Grundverordnung
        (DSGVO) ist:
      </p>
      <p>
        <strong>{LEGAL.operator}</strong>
        <br />
        {LEGAL.street}
        <br />
        {LEGAL.postalCity}, {LEGAL.country}
        <br />
        E-Mail: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
      </p>

      <h2>2. Welche Daten wir bearbeiten</h2>
      <h3>Kontodaten</h3>
      <p>
        Bei der Registrierung mit E-Mail erfassen wir deine <strong>E-Mail-Adresse</strong> und ein
        <strong> Passwort</strong>. Das Passwort wird ausschliesslich verschlüsselt (gehasht) durch
        unseren Authentifizierungs-Dienst gespeichert; wir sehen es zu keinem Zeitpunkt im Klartext.
      </p>
      <p>
        Systemmails, etwa den Link zum Zurücksetzen deines Passworts oder die Bestätigung einer
        neuen oder geänderten E-Mail-Adresse, schicken wir dir über einen E-Mail-Dienst (siehe
        Ziffer 4). Dieser erhält dafür deine E-Mail-Adresse und den Inhalt der Nachricht.
      </p>
      <p>
        Meldest du dich stattdessen über <strong>Google</strong> oder <strong>GitHub</strong> an,
        gibt es bei uns kein Passwort. Wir erhalten dann vom jeweiligen Anbieter deine
        E-Mail-Adresse, deinen Namen bzw. Benutzernamen, die Adresse deines Profilbilds und eine
        Kennung deines Kontos bei diesem Anbieter. Diese Angaben speichert unser
        Authentifizierungs-Dienst zusammen mit deinem Konto; das Profilbild zeigen wir nicht an.
      </p>
      <p>
        Als <strong>Anzeigenamen</strong> verwenden wir den Namen aus Google oder GitHub oder, wenn
        es keinen gibt, den Teil deiner E-Mail-Adresse vor dem @. Du kannst ihn in den Einstellungen
        ändern.
      </p>
      <h3>Inhaltsdaten</h3>
      <p>
        Wir bearbeiten, was du im Dienst eingibst und ablegst:{" "}
        <strong>Chat-Nachrichten</strong> (deine Eingaben und die Antworten des Modells),{" "}
        <strong>Projekte</strong> samt Name, Anweisungen und Kontextangaben,{" "}
        <strong>gespeicherte Prompts</strong> sowie <strong>Dateien</strong>, die du an ein Projekt
        anhängst (Text-, Code- und Konfigurationsdateien sowie Bilder wie Screenshots, höchstens{" "}
        {MAX_FILES_PER_PROJECT} Dateien und {MAX_PROJECT_MB} MB pro Projekt). Diese Inhalte werden in
        deinem Workspace gespeichert, damit du sie wieder aufrufen kannst.
      </p>
      <h3>Anhänge im Chat (optional)</h3>
      <p>
        An eine Chat-Nachricht kannst du <strong>Fotos und Dateien</strong> hängen (Bilder wie
        Screenshots sowie Text-, Code- und Konfigurationsdateien, höchstens{" "}
        {MAX_ATTACHMENTS_PER_MESSAGE} je Nachricht). Fotos verkleinert dein Browser vor dem Senden.
        Wir speichern sie in einem privaten Dateispeicher, auf den nur dein Konto Zugriff hat,
        zusammen mit dem Dateinamen, und zeigen sie dir über kurzlebige Adressen im Chat wieder an.
        Insgesamt kann ein Konto höchstens {MAX_ATTACHMENT_STORAGE_MB} MB an Anhängen belegen.
      </p>
      <p>
        Damit das Modell sie berücksichtigen kann, gehen sie bei der Antwort an den Modellanbieter
        (Ziffer 4). Das gilt auch für spätere Antworten im selben Chat, solange die Nachricht im
        Verlauf steht: begrenzt auf die jüngsten Anhänge, Textdateien nur zu Beginn gekürzt. Wir
        durchsuchen Anhänge nicht und werten sie nicht für andere Zwecke aus. Löschst du den Chat,
        das Projekt oder dein Konto, werden die Dateien aus dem Speicher mit gelöscht.
      </p>
      <h3>Projekt-Gedächtnis (optional)</h3>
      <p>
        Startest du in einem Projekt die Analyse für das <strong>Projekt-Gedächtnis</strong>, werten
        wir die angehängten Dateien und Screenshots aus und, falls du eines angibst, ein{" "}
        <strong>öffentliches GitHub-Repository</strong>. Dafür ruft unser Server bei GitHub die
        öffentlich zugänglichen Angaben und einzelne Dateien dieses Repositorys ab; GitHub erfährt
        dabei nur Besitzer- und Repository-Namen, nicht, wer du bist. Die Inhalte gehen zur
        Auswertung an den Modellanbieter (Ziffer 4). Gespeichert werden nur das Ergebnis, also eine
        kurze Zusammenfassung von Technik, Aufbau und Konventionen deines Projekts, die Adresse des
        Repositorys und die Namen der ausgewerteten Quellen, nicht deren Inhalt.
      </p>
      <h3>Sprachmodus (Mikrofon, optional)</h3>
      <p>
        Wenn du im Chat den optionalen <strong>Sprachmodus</strong> nutzt, greifst du über eine
        Funktion deines Browsers auf dein <strong>Mikrofon</strong> zu, um eine Nachricht zu
        diktieren statt zu tippen. Die Spracherkennung selbst läuft nicht über unsere Server,
        sondern über deinen Browser, siehe dazu Ziffer 4. Bei uns kommt ausschliesslich der
        daraus erzeugte <strong>Text</strong> an, wie bei einer getippten Nachricht. Der
        Sprachmodus ist rein optional und braucht deine ausdrückliche Freigabe des Mikrofons;
        ohne sie funktioniert der Chat unverändert über die Tastatur.
      </p>
      <p>
        Bevor du ihn zum ersten Mal nutzt, fragen wir dich, ob du damit einverstanden bist, dass
        dein Browser die Aufnahme an den Anbieter der Spracherkennung schickt (Ziffer 4). Deine
        Zustimmung merkt sich dein Browser, nicht wir (Eintrag{" "}
        <code>pp-voice-consent</code>, siehe <a href="/cookies">Cookie-Richtlinie</a>). Du kannst
        sie jederzeit im Sprachmodus widerrufen oder den Eintrag in deinem Browser löschen.
      </p>
      <h3>Eigene API-Schlüssel (optional)</h3>
      <p>
        Wenn du in den Einstellungen einen <strong>eigenen Zugang zu einem Modellanbieter</strong>{" "}
        hinterlegst, speichern wir diesen Schlüssel <strong>verschlüsselt</strong> (AES-256-GCM) mit
        einem Schlüssel, der ausserhalb der Datenbank auf dem Server liegt. Er wird ausschliesslich
        dazu verwendet, deine Anfragen bei deinem Anbieter auszuführen, und niemals im Klartext
        angezeigt. Du kannst ihn jederzeit wieder entfernen.
      </p>
      <h3>Kontaktformular</h3>
      <p>
        Schreibst du mir über das Formular auf der <a href="/kontakt">Kontaktseite</a>, bearbeiten
        wir deine <strong>E-Mail-Adresse</strong>, deine Nachricht, das gewählte Thema und, wenn du
        ihn angibst, deinen Namen. Die Nachricht geht per E-Mail an uns (Versand über Resend, siehe
        Ziffer 4); wir speichern sie nicht in unserer Datenbank. Auf der Seite läuft die
        Mensch-Prüfung von Cloudflare, dabei wird deine IP-Adresse übermittelt, und wir zählen die
        Nachrichten je IP-Adresse, um Missbrauch zu begrenzen. Du kannst uns auch direkt per
        E-Mail schreiben.
      </p>
      <h3>Nutzungs- und Protokolldaten</h3>
      <p>
        Zum Schutz vor Missbrauch und zur Begrenzung der Anfragen (Rate-Limiting) bearbeiten wir
        deine <strong>IP-Adresse</strong> sowie technische Zeitstempel. Beim Anmelden, Registrieren
        und beim Zurücksetzen des Passworts wird deine IP-Adresse zusätzlich an den Captcha-Dienst
        von Cloudflare übermittelt, um automatisierte Zugriffe abzuwehren (siehe Ziffer 4). Wir
        führen serverseitige Fehler- und Betriebsprotokolle, in denen Zugangsdaten und Schlüssel
        automatisch unkenntlich gemacht werden. Diese Daten dienen ausschliesslich dem sicheren
        Betrieb und werden nicht zur Profilbildung verwendet.
      </p>
      <h3>Messung der Ladegeschwindigkeit</h3>
      <p>
        Damit wir sehen, wie schnell PromptPrinter bei dir lädt und wo es hakt, messen wir mit{" "}
        <strong>Vercel Speed Insights</strong> die Ladezeiten der Seiten (die sogenannten Web
        Vitals). Dein Browser meldet dazu bei jedem Seitenaufruf Messwerte an Vercel. Mit jedem
        Messwert werden gespeichert: die aufgerufene Seite, die Netzwerkgeschwindigkeit, Browser,
        Gerätetyp und Betriebssystem, das Land, die Art des Messwerts samt dem betroffenen
        Seitenelement, die Version der Messbibliothek und der Zeitpunkt des Empfangs. Adressen mit
        einer Kennung, etwa die eines einzelnen Chats oder Projekts, kürzen wir vor dem Senden auf ein
        Muster, und Angaben hinter einem Fragezeichen oder Doppelkreuz in der Adresse senden wir gar
        nicht erst mit. Nach Angaben von Vercel sind die Messwerte weder einer einzelnen Person noch
        einer IP-Adresse zugeordnet und erlauben es nicht, einen Besuch über mehrere Seiten hinweg
        nachzuvollziehen. Dafür werden weder Cookies gesetzt noch Daten in deinem Browser gespeichert.
      </p>
      <h3>Cookies</h3>
      <p>
        Wir setzen ausschliesslich <strong>technisch notwendige Cookies</strong> ein: Anmelde-Cookies
        unseres Authentifizierungs-Dienstes (Präfix <code>sb-</code>), die deine Sitzung
        aufrechterhalten, und zwei Cookies für die Seitenleiste (<code>pp-sidebar</code>,{" "}
        <code>pp-sidebar-width</code>), die keine Personendaten enthalten. Deine Theme-Einstellung
        (hell/dunkel) und deine Zustimmung zum Sprachmodus liegen im lokalen Speicher deines
        Browsers und werden nicht an uns übertragen. Es
        kommen <strong>keine Tracking-, Analyse- oder Werbe-Cookies</strong> zum Einsatz und wir
        betreiben kein Drittanbieter-Tracking; die oben beschriebene Messung der Ladegeschwindigkeit
        arbeitet ohne Cookies. Weil alle eingesetzten Cookies
        technisch notwendig sind, ist dafür keine Einwilligung erforderlich, es gibt daher bewusst
        kein Cookie-Banner. Jeden Eintrag mit Zweck und Speicherdauer sowie den Weg, Cookies
        abzulehnen, findest du in der <a href="/cookies">Cookie-Richtlinie</a>.
      </p>

      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>
          <strong>Bereitstellung des Dienstes</strong> (Konto, Erstellung und Speicherung von
          Projekten, KI-Generierung), zur Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b
          DSGVO; Art. 31 Abs. 1 revDSG).
        </li>
        <li>
          <strong>Sicherheit und Missbrauchsschutz</strong> (Rate-Limiting, Captcha auf den
          Anmeldeformularen, Protokolle), aufgrund unseres berechtigten Interesses am stabilen und
          sicheren Betrieb und am Schutz vor automatisierten Angriffen (Art. 6 Abs. 1 lit. f DSGVO;
          Art. 31 Abs. 1 revDSG).
        </li>
        <li>
          <strong>Messung der Ladegeschwindigkeit</strong> (Vercel Speed Insights), aufgrund unseres
          berechtigten Interesses, den Dienst schnell zu halten und Leistungsprobleme zu erkennen
          (Art. 6 Abs. 1 lit. f DSGVO; Art. 31 Abs. 1 revDSG).
        </li>
        <li>
          <strong>Beantwortung deiner Anfragen</strong> über das Kontaktformular oder per E-Mail,
          aufgrund unseres berechtigten Interesses, dir zu antworten, und, wenn es um dein Konto
          oder den Vertrag geht, zu dessen Erfüllung (Art. 6 Abs. 1 lit. b und f DSGVO; Art. 31
          Abs. 1 revDSG).
        </li>
        <li>
          <strong>KI-Verarbeitung deiner Eingaben</strong> zur Erzeugung der Antworten im Chat und,
          wenn du es startest, zur Analyse für das Projekt-Gedächtnis, zur Erfüllung des
          Nutzungsvertrags.
        </li>
      </ul>
      <p>
        Für ein Konto brauchen wir eine E-Mail-Adresse oder die Anmeldung über Google bzw. GitHub;
        ohne sie können wir den Dienst nicht bereitstellen. Alle übrigen Angaben sind freiwillig.
      </p>
      <p>
        Wir treffen keine automatisierten Einzelentscheidungen, die dir gegenüber rechtliche Wirkung
        entfalten oder dich erheblich beeinträchtigen, und wir betreiben kein Profiling. Die KI
        erzeugt Textvorschläge für dich, sie entscheidet nichts über dich.
      </p>

      <h2>4. Eingesetzte Dienste und Auftragsbearbeiter</h2>
      <p>
        Wir setzen sorgfältig ausgewählte Dienstleister ein, die Daten in unserem Auftrag bearbeiten,
        jeweils auf Grundlage der von diesen Anbietern bereitgestellten Vereinbarungen zur
        Auftragsbearbeitung:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (Supabase Pte. Ltd., Singapur): Authentifizierung, Datenbank und
          Dateispeicher für deine Konto- und Inhaltsdaten, einschliesslich hochgeladener
          Projektdateien und Chat-Anhänge.
          Datenregion: {LEGAL.dataRegion}. Nach den Bedingungen von Supabase kann die Bearbeitung
          auch dort stattfinden, wo Supabase oder seine Unterauftragnehmer Einrichtungen betreiben.
        </li>
        <li>
          <strong>Resend</strong> (Plus Five Five, Inc., USA): Versand der System-E-Mails, nämlich
          des Links zum Zurücksetzen deines Passworts und, wenn sie ausgelöst werden, der Mails zur
          Bestätigung oder Änderung deiner E-Mail-Adresse, ausserdem die Zustellung der Nachrichten
          aus dem Kontaktformular an uns. Dafür werden deine{" "}
          <strong>E-Mail-Adresse</strong> und der Inhalt der jeweiligen Nachricht (Link, Zeitpunkt)
          an den Anbieter übermittelt. Für unsere Absenderadresse ist die Region Irland eingestellt;
          nach der Vereinbarung zur Auftragsbearbeitung kann die Bearbeitung dennoch überwiegend
          in den USA stattfinden. Resend gibt an, unter dem EU-US Data Privacy Framework
          zertifiziert zu sein; ergänzend gelten die Standardvertragsklauseln in seiner
          Vereinbarung zur Auftragsbearbeitung. Nach Angaben von Resend werden Mailinhalte 30 Tage
          aufbewahrt.
        </li>
        <li>
          <strong>{LEGAL.appHost}</strong>: Betrieb und Auslieferung der Anwendung. Dabei fallen
          serverseitige Zugriffs- und Fehlerprotokolle an.
        </li>
        <li>
          <strong>Vercel Speed Insights</strong> (Vercel Inc., USA): Messung der Ladegeschwindigkeit,
          siehe Ziffer 2. Das Messskript wird über unsere eigene Adresse ausgeliefert, die Messwerte
          gehen an Vercel.
        </li>
        <li>
          <strong>Cloudflare</strong> (Cloudflare, Inc.): Captcha (Turnstile) auf den Formularen für
          Anmeldung, Registrierung, Passwort-Zurücksetzen und Kontakt. Dazu wird ein Skript von Cloudflare in
          deinem Browser geladen und deine <strong>IP-Adresse</strong> sowie technische
          Browser-Merkmale werden zur Prüfung übermittelt, ob die Anfrage automatisiert ist.
        </li>
        <li>
          <strong>Z.ai</strong> (JINGSHENG HENGXING TECHNOLOGY PTE. LTD., Singapur, die internationale
          Plattform des chinesischen KI-Unternehmens Zhipu AI): deine Chat-Nachrichten und der
          jeweilige Projektkontext, angehängte Fotos und Dateien, beim Projekt-Gedächtnis auch
          Projektdateien, Screenshots und Repository-Inhalte, werden zur Erzeugung der Antwort an
          die Z.ai-API übermittelt. Nach
          Angaben von Z.ai werden sie in der Regel in <strong>Singapur</strong> bearbeitet. Eine
          Bearbeitung durch Konzerngesellschaften in <strong>China</strong> können wir nicht
          ausschliessen. Nach der Vereinbarung zur Auftragsbearbeitung von Z.ai speichert Z.ai die
          Inhalte von API-Anfragen nicht auf seinen Servern, sondern verarbeitet sie in Echtzeit.
        </li>
        <li>
          <strong>Upstash</strong> (Upstash Inc., USA): Rate-Limiting und Kontingentzählung;
          bearbeitet zu diesem Zweck deine IP-Adresse bzw. eine Nutzerkennung. Datenregion: EU
          (Frankfurt).
        </li>
        <li>
          <strong>Lemon Squeezy</strong> (Lemon Squeezy, LLC, USA): Zahlungsabwicklung für den
          Pro-Plan. Anders als die übrigen hier genannten Dienste handelt Lemon Squeezy nicht in
          unserem Auftrag, sondern als „Merchant of Record“, also als Verkäufer in eigenem Namen,
          und ist für die Zahlungs- und Rechnungsdaten <strong>eigenverantwortlich</strong>. Auf der{" "}
          <a href="/pricing">Preisseite</a> und der Abrechnungsseite wird dazu ein Skript von Lemon
          Squeezy in deinem Browser geladen, wobei deine <strong>IP-Adresse</strong> übermittelt
          wird. Deine Zahlungsdaten gibst du im eingebetteten Bezahlfenster direkt bei Lemon Squeezy
          ein; sie erreichen uns nicht. Wir erhalten von dort nur, was zur Zuordnung deines Abos
          nötig ist, insbesondere Mailadresse und Status des Abonnements.
        </li>
      </ul>
      <DatenschutzWeitereEmpfaenger />

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
        diese Länder dennoch nicht vollständig zusichern. Wenn du das vermeiden möchtest, kannst du in den
        Einstellungen einen eigenen API-Schlüssel eines Anbieters deiner Wahl hinterlegen; deine
        Eingaben gehen dann nicht mehr an Z.ai.
      </p>

      <h2>6. Speicherdauer</h2>
      <p>
        Wir speichern deine Konto- und Inhaltsdaten, solange dein Konto besteht. Löschst du dein
        Konto, werden Profil, Chats samt Anhängen, Projekte, gespeicherte Prompts sowie hochgeladene
        Projektdateien gelöscht. Dasselbe gilt für Anhänge, wenn du einen einzelnen Chat oder ein
        Projekt löschst. Zähler für Rate-Limiting und Monatskontingente liegen in einem
        Zwischenspeicher mit automatischem Ablauf (je nach Zweck von wenigen Minuten bis zu 45 Tagen)
        und werden danach selbsttätig entfernt. Nachrichten aus dem Kontaktformular und E-Mails an uns
        bewahren wir in unserem Postfach so lange auf, wie wir sie für die Antwort und mögliche
        Rückfragen brauchen. Der E-Mail-Dienst (Ziffer 4) bewahrt die Mailinhalte, auch die des
        Kontaktformulars, nach eigenen Angaben 30 Tage auf. Server- und Fehlerprotokolle unseres Hosting-Anbieters
        sowie die Messwerte zur Ladegeschwindigkeit werden nach dessen Aufbewahrungsfristen gelöscht. Gesetzliche Aufbewahrungspflichten,
        insbesondere für Rechnungsunterlagen aus der Zahlungsabwicklung, bleiben vorbehalten.
        Sprachaufnahmen aus dem Sprachmodus durchlaufen unsere Server nicht und werden von uns
        nicht gespeichert (Ziffer 4); wie lange dein Browser-Anbieter sie bei sich verarbeitet,
        richtet sich nach dessen eigenen Bestimmungen.
      </p>

      <h2>7. Deine Rechte</h2>
      <p>Du hast (im Rahmen des anwendbaren Rechts) das Recht auf:</p>
      <ul>
        <li>Auskunft über die zu dir bearbeiteten Personendaten;</li>
        <li>Berichtigung unrichtiger Daten;</li>
        <li>Löschung deiner Daten;</li>
        <li>Einschränkung der Bearbeitung und Widerspruch;</li>
        <li>Datenübertragbarkeit (Herausgabe in einem gängigen Format).</li>
      </ul>
      <p>
        Zur Ausübung dieser Rechte genügt eine Nachricht an{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Auskunft, Berichtigung und Herausgabe
        deiner Daten bearbeiten wir manuell, es gibt dafür (noch) keine Schaltfläche in der App; wir
        antworten so rasch wie möglich, spätestens innerhalb von 30 Tagen. Das Löschen deines Kontos
        kannst du dagegen jederzeit selbst auslösen, siehe Ziffer 8. Du hast zudem das Recht, dich
        bei einer Aufsichtsbehörde zu beschweren, in der Schweiz beim Eidgenössischen Datenschutz-
        und Öffentlichkeitsbeauftragten (EDÖB), in der EU bei der für dich zuständigen
        Datenschutzbehörde.
      </p>

      <h2>8. Konto und Daten löschen</h2>
      <p>
        Du kannst dein Konto jederzeit selbst löschen, direkt in der App unter{" "}
        <strong>Einstellungen</strong>. Dabei werden dein Profil, deine Chats und Nachrichten, deine
        Projekte samt hochgeladenen Dateien und Projekt-Gedächtnis, alle Anhänge deiner Chats, deine
        gespeicherten Prompts sowie hinterlegte API-Schlüssel unwiderruflich entfernt. Die Löschung erfolgt sofort und nicht erst nach
        einer Frist.
      </p>

      <h2>9. Kontakt</h2>
      <p>
        Bei Fragen zum Datenschutz erreichst du uns unter{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalShell>
  );
}

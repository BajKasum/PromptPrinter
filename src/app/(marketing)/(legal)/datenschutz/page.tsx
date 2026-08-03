import type { Metadata } from "next";
import { LegalShell } from "@/features/marketing/components/legal-shell";
import { LEGAL } from "@/shared/lib/legal";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Wie PromptPrinter deine Personendaten bearbeitet: Konto, Eingaben, KI-Verarbeitung und deine Rechte.",
};

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
        Bei der Registrierung erfassen wir deine <strong>E-Mail-Adresse</strong> und ein
        <strong> Passwort</strong>. Das Passwort wird ausschliesslich verschlüsselt (gehasht) durch
        unseren Authentifizierungs-Dienst gespeichert; wir sehen es zu keinem Zeitpunkt im Klartext.
      </p>
      <h3>Inhaltsdaten</h3>
      <p>
        Wir bearbeiten, was du im Dienst eingibst und ablegst:{" "}
        <strong>Chat-Nachrichten</strong> (deine Eingaben und die Antworten des Modells),{" "}
        <strong>Projekte</strong> samt Name, Anweisungen und Kontextangaben,{" "}
        <strong>gespeicherte Prompts</strong> sowie <strong>Dateien</strong>, die du an ein Projekt
        anhängst (Textformate wie .md, .txt, .json, .csv, begrenzt in Anzahl und Grösse). Optional
        kommt ein <strong>Profilbild</strong> dazu, wenn du eines hochlädst. Diese Inhalte werden in
        deinem Workspace gespeichert, damit du sie wieder aufrufen kannst.
      </p>
      <h3>Eigene API-Schlüssel (optional)</h3>
      <p>
        Wenn du in den Einstellungen einen <strong>eigenen Zugang zu einem Modellanbieter</strong>{" "}
        hinterlegst, speichern wir diesen Schlüssel <strong>verschlüsselt</strong> (AES-256-GCM) mit
        einem Schlüssel, der ausserhalb der Datenbank auf dem Server liegt. Er wird ausschliesslich
        dazu verwendet, deine Anfragen bei deinem Anbieter auszuführen, und niemals im Klartext
        angezeigt. Du kannst ihn jederzeit wieder entfernen.
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
      <h3>Cookies</h3>
      <p>
        Wir setzen ausschliesslich <strong>technisch notwendige Cookies</strong>, und zwar nur diese
        beiden Sorten:
      </p>
      <ul>
        <li>
          <strong>Anmelde-Cookies</strong> unseres Authentifizierungs-Dienstes (Präfix{" "}
          <code>sb-</code>), die deine Sitzung aufrechterhalten. Ohne sie ist kein Login möglich.
        </li>
        <li>
          <strong>Oberflächen-Einstellungen</strong> (<code>pp-sidebar</code>,{" "}
          <code>pp-sidebar-width</code>), die sich merken, ob die Seitenleiste ein- oder ausgeklappt
          ist und wie breit sie war. Sie enthalten keine Personendaten, sondern eine Ziffer bzw.
          eine Breitenangabe.
        </li>
      </ul>
      <p>
        Deine Theme-Einstellung (hell/dunkel) liegt im lokalen Speicher deines Browsers und wird
        nicht an uns übertragen. Der Captcha-Dienst von Cloudflare kann beim Anmelden eigene
        technisch notwendige Cookies setzen. Es kommen{" "}
        <strong>keine Tracking-, Analyse- oder Werbe-Cookies</strong> zum Einsatz, wir betreiben
        keine Webanalyse und kein Drittanbieter-Tracking. Weil alle eingesetzten Cookies technisch
        notwendig sind, ist dafür keine Einwilligung erforderlich, es gibt daher bewusst kein
        Cookie-Banner.
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
          <strong>KI-Verarbeitung deiner Eingaben</strong> zur Erzeugung der Antworten im Chat, zur
          Erfüllung des Nutzungsvertrags.
        </li>
      </ul>

      <h2>4. Eingesetzte Dienste und Auftragsbearbeiter</h2>
      <p>
        Wir setzen sorgfältig ausgewählte Dienstleister ein, die Daten in unserem Auftrag bearbeiten,
        jeweils auf Grundlage der von diesen Anbietern bereitgestellten Vereinbarungen zur
        Auftragsbearbeitung:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (Supabase Inc.): Authentifizierung, Datenbank und Dateispeicher
          für deine Konto- und Inhaltsdaten, einschliesslich hochgeladener Projektdateien und
          Profilbilder. Datenregion: {LEGAL.dataRegion}.
        </li>
        <li>
          <strong>{LEGAL.appHost}</strong>: Betrieb und Auslieferung der Anwendung. Dabei fallen
          serverseitige Zugriffs- und Fehlerprotokolle an.
        </li>
        <li>
          <strong>Cloudflare</strong> (Cloudflare, Inc.): Captcha (Turnstile) auf den Formularen für
          Anmeldung, Registrierung und Passwort-Zurücksetzen. Dazu wird ein Skript von Cloudflare in
          deinem Browser geladen und deine <strong>IP-Adresse</strong> sowie technische
          Browser-Merkmale werden zur Prüfung übermittelt, ob die Anfrage automatisiert ist.
        </li>
        <li>
          <strong>Z.ai</strong> (Zhipu AI): deine Chat-Nachrichten und der jeweilige Projektkontext
          werden zur Erzeugung der Antwort an die Z.ai-API übermittelt. Dabei findet eine
          Übermittlung nach <strong>China</strong> statt.
        </li>
        <li>
          <strong>Google Gemini</strong> (Google Ireland Ltd. / Google LLC): als Ausweich-Anbieter,
          falls Z.ai nicht verfügbar ist. Dabei kann eine Übermittlung in die <strong>USA</strong>{" "}
          stattfinden.
        </li>
        <li>
          <strong>Upstash</strong> (Upstash Inc.): Rate-Limiting und Kontingentzählung; bearbeitet zu
          diesem Zweck deine IP-Adresse bzw. eine Nutzerkennung.
        </li>
      </ul>
      <p>
        <strong>Wenn du einen eigenen API-Schlüssel hinterlegst</strong>, gehen deine Eingaben nicht
        mehr an die oben genannten Modellanbieter, sondern an den von dir gewählten Anbieter, je
        nach deiner Auswahl etwa <strong>Anthropic</strong> (Anthropic PBC, USA),{" "}
        <strong>OpenAI</strong> (OpenAI, L.L.C., USA), <strong>Google</strong> oder einen von dir
        selbst eingetragenen, kompatiblen Endpunkt. In diesem Fall bestimmst du den Empfänger, und
        es gelten zusätzlich dessen Datenschutzbestimmungen. Auf die Bearbeitung durch diesen
        Anbieter haben wir keinen Einfluss.
      </p>
      <p>
        Wir geben deine Daten nicht zu Werbezwecken weiter und verkaufen sie nicht. Wir werten deine
        Inhalte nicht aus, um damit KI-Modelle zu trainieren.
      </p>

      <h2>5. Übermittlung in Drittländer</h2>
      <p>
        Einzelne der oben genannten Dienste bearbeiten Daten ausserhalb der Schweiz bzw. des EWR,
        namentlich in den <strong>USA</strong> ({LEGAL.appHost}, Cloudflare, Upstash, Google Gemini
        sowie gegebenenfalls der von dir gewählte eigene Anbieter) und in{" "}
        <strong>China</strong> (Z.ai).
      </p>
      <p>
        Für Übermittlungen in die USA stützen wir uns auf die Standardvertragsklauseln der
        EU-Kommission und, soweit der jeweilige Anbieter entsprechend zertifiziert ist, ergänzend
        auf das EU-US bzw. Swiss-US Data Privacy Framework. Für China besteht weder ein
        Angemessenheitsbeschluss der EU-Kommission noch eine Anerkennung durch den Schweizer
        Bundesrat; wir stützen diese Übermittlung auf die Standardvertragsklauseln als geeignete
        Garantie. Ein gleichwertiges Datenschutzniveau kann für China trotz dieser Garantien nicht
        vollständig zugesichert werden. Wenn du das vermeiden möchtest, kannst du in den
        Einstellungen einen eigenen API-Schlüssel eines Anbieters deiner Wahl hinterlegen; deine
        Eingaben gehen dann nicht mehr an Z.ai.
      </p>

      <h2>6. Speicherdauer</h2>
      <p>
        Wir speichern deine Konto- und Inhaltsdaten, solange dein Konto besteht. Löschst du dein
        Konto, werden Profil, Chats, Projekte, gespeicherte Prompts sowie hochgeladene Projektdateien
        und dein Profilbild gelöscht. Zähler für Rate-Limiting und Monatskontingente liegen in einem
        Zwischenspeicher mit automatischem Ablauf (je nach Zweck von wenigen Minuten bis zu 45 Tagen)
        und werden danach selbsttätig entfernt. Server- und Fehlerprotokolle unseres Hosting-Anbieters
        werden nach dessen Aufbewahrungsfristen gelöscht. Gesetzliche Aufbewahrungspflichten,
        insbesondere für Rechnungsunterlagen nach einer künftigen Zahlungsabwicklung, bleiben
        vorbehalten.
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
        Projekte samt hochgeladenen Dateien, deine gespeicherten Prompts, ein allfälliges Profilbild
        sowie hinterlegte API-Schlüssel unwiderruflich entfernt. Die Löschung erfolgt sofort und
        nicht erst nach einer Frist.
      </p>

      <h2>9. Kontakt</h2>
      <p>
        Bei Fragen zum Datenschutz erreichst du uns unter{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalShell>
  );
}

import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Datenschutz",
  description:
    "Wie PromptPrinter deine Personendaten bearbeitet — Konto, Eingaben, KI-Verarbeitung und deine Rechte.",
};

export default function DatenschutzPage() {
  return (
    <LegalShell
      badge="Rechtliches"
      title="Datenschutzerklärung"
      intro="Wir bearbeiten nur die Daten, die für den Betrieb von PromptPrinter nötig sind — und legen offen, an wen sie weitergegeben werden."
      updated={LEGAL.lastUpdated}
    >
      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Bearbeitung deiner Personendaten im Sinne des Schweizer
        Datenschutzgesetzes (revDSG) und – soweit anwendbar – der EU-Datenschutz-Grundverordnung
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
        Wenn du ein Projekt erstellst, bearbeiten wir die von dir eingegebenen{" "}
        <strong>Projektangaben</strong> (Projektname, Idee, Zielgruppe, ausgewählte Tools) sowie die
        daraus generierten Artefakte. Diese Inhalte werden in deinem Workspace gespeichert, damit du
        sie wieder aufrufen kannst.
      </p>
      <h3>Nutzungs- und Protokolldaten</h3>
      <p>
        Zum Schutz vor Missbrauch und zur Begrenzung der Anfragen (Rate-Limiting) bearbeiten wir
        deine <strong>IP-Adresse</strong> sowie technische Zeitstempel. Diese Daten dienen
        ausschliesslich dem sicheren Betrieb und werden nicht zur Profilbildung verwendet.
      </p>
      <h3>Cookies</h3>
      <p>
        Wir setzen ausschliesslich <strong>technisch notwendige Cookies</strong> für die Anmeldung
        (Session). Es kommen <strong>keine Tracking-, Analyse- oder Werbe-Cookies</strong> zum
        Einsatz, und wir betreiben kein Drittanbieter-Tracking.
      </p>

      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>
          <strong>Bereitstellung des Dienstes</strong> (Konto, Erstellung und Speicherung von
          Projekten, KI-Generierung) — zur Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b
          DSGVO; Art. 31 Abs. 1 revDSG).
        </li>
        <li>
          <strong>Sicherheit und Missbrauchsschutz</strong> (Rate-Limiting, Protokolle) — aufgrund
          unseres berechtigten Interesses am stabilen und sicheren Betrieb (Art. 6 Abs. 1 lit. f
          DSGVO).
        </li>
        <li>
          <strong>KI-Verarbeitung deiner Eingaben</strong> zur Erzeugung der Artefakte — zur
          Erfüllung des Nutzungsvertrags.
        </li>
      </ul>

      <h2>4. Eingesetzte Dienste und Auftragsbearbeiter</h2>
      <p>
        Wir setzen sorgfältig ausgewählte Dienstleister ein, die Daten in unserem Auftrag bearbeiten.
        Mit diesen bestehen entsprechende Auftragsbearbeitungsverträge:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (Supabase Inc.) — Authentifizierung, Datenbank und Speicherung
          deiner Konto- und Inhaltsdaten. Datenregion: {LEGAL.dataRegion}.
        </li>
        <li>
          <strong>Google Gemini</strong> (Google Ireland Ltd. / Google LLC) — die von dir
          eingegebenen Projektangaben werden zur KI-Generierung an die Gemini-API übermittelt. Dabei
          kann eine Übermittlung in die <strong>USA</strong> stattfinden.
        </li>
        <li>
          <strong>Upstash</strong> (Upstash Inc.) — Rate-Limiting (sofern aktiviert); bearbeitet zu
          diesem Zweck deine IP-Adresse bzw. eine Nutzerkennung.
        </li>
        <li>
          <strong>{LEGAL.appHost}</strong> — Betrieb und Auslieferung der Anwendung.
        </li>
      </ul>
      <p>
        Wir geben deine Daten nicht zu Werbezwecken weiter und verkaufen sie nicht.
      </p>

      <h2>5. Übermittlung in Drittländer</h2>
      <p>
        Einzelne der oben genannten Dienste können Daten ausserhalb der Schweiz bzw. des EWR – insbesondere
        in den <strong>USA</strong> – bearbeiten. Soweit ein Land kein gleichwertiges Datenschutzniveau
        gewährleistet, stützen wir solche Übermittlungen auf geeignete Garantien, namentlich die
        Standardvertragsklauseln der EU-Kommission bzw. eine Zertifizierung nach dem EU-US Data Privacy
        Framework.
      </p>

      <h2>6. Speicherdauer</h2>
      <p>
        Wir speichern deine Konto- und Inhaltsdaten, solange dein Konto besteht. Löschst du dein
        Konto, werden die zugehörigen Projekte und Generierungen gelöscht. Protokolldaten zum
        Rate-Limiting werden nur kurzzeitig vorgehalten und automatisch überschrieben.
      </p>

      <h2>7. Deine Rechte</h2>
      <p>Du hast – im Rahmen des anwendbaren Rechts – das Recht auf:</p>
      <ul>
        <li>Auskunft über die zu dir bearbeiteten Personendaten;</li>
        <li>Berichtigung unrichtiger Daten;</li>
        <li>Löschung deiner Daten;</li>
        <li>Einschränkung der Bearbeitung und Widerspruch;</li>
        <li>Datenübertragbarkeit (Herausgabe in einem gängigen Format).</li>
      </ul>
      <p>
        Zur Ausübung dieser Rechte genügt eine Nachricht an{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Du hast zudem das Recht, dich bei einer
        Aufsichtsbehörde zu beschweren – in der Schweiz beim Eidgenössischen Datenschutz- und
        Öffentlichkeitsbeauftragten (EDÖB), in der EU bei der für dich zuständigen Datenschutzbehörde.
      </p>

      <h2>8. Konto und Daten löschen</h2>
      <p>
        Du kannst dein Konto jederzeit selbst löschen — direkt in der App unter{" "}
        <strong>Einstellungen</strong>. Dabei werden dein Profil sowie alle zugehörigen Projekte und
        Generierungen unwiderruflich entfernt.
      </p>

      <h2>9. Kontakt</h2>
      <p>
        Bei Fragen zum Datenschutz erreichst du uns unter{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalShell>
  );
}

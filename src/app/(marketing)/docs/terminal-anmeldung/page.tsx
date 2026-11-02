import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import { docMetadata } from "@/features/marketing/lib/article-metadata";

const doc = docBySlug("terminal-anmeldung")!;

export const metadata: Metadata = docMetadata(doc);

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Anmeldung im Terminal"
      intro="Ein Terminal hat kein Passwortfeld und kein Cookie. So meldet es sich bei deinem Konto an, ohne dass du ein Passwort eintippst."
    >
      <p>
        Das Terminal-Programm zu PromptPrinter ist noch in Arbeit. Diese Seite beschreibt die
        Anmeldung, die der Server dafür schon kann, und was dabei geschützt ist.
      </p>

      <h2>Wie läuft die Anmeldung ab?</h2>
      <ol>
        <li>
          Das Terminal fragt den Server nach einem Code und zeigt ihn an: acht Zeichen, zum Beispiel{" "}
          <code>BCDF-GHJK</code>. Dazu schickt es den Namen des Geräts.
        </li>
        <li>
          Du öffnest in deinem Browser, eingeloggt, die Seite <code>/cli</code> und tippst den Code ab.
        </li>
        <li>
          Die Seite zeigt den Gerätenamen, die Uhrzeit, die Adresse, den ungefähren Ort und das Programm der
          Anfrage. Den Namen wählt das Terminal selbst, die Adresse nicht. Kommt die Anfrage von einer anderen
          Adresse als dein Browser, sagt die Seite es. Du bestätigst oder lehnst ab.
        </li>
        <li>
          Das Terminal holt danach einmal seine eigene Anmeldung ab. Der Code gilt zehn Minuten und nur
          ein einziges Mal.
        </li>
      </ol>

      <h2>Wann bestätige ich?</h2>
      <p>
        Nur, wenn du den Befehl im Terminal gerade selbst gestartet hast. Wer dir einen Code schickt und
        dich bittet, ihn zu bestätigen, will sich in dein Konto einloggen. Der Code steht deshalb nie in
        einem Link, den du anklicken könntest: du tippst ihn ab, damit du ihn nur bestätigst, wenn er auf
        deinem eigenen Bildschirm steht.
      </p>

      <h2>Was darf das Terminal?</h2>
      <p>
        Es hat dasselbe Konto wie dein Browser und gilt für dieselben Grenzen: dein Plan, die Limits und
        die Zustimmung zur Übermittlung an Z.ai sind dieselben wie im Chat im Browser. Ein Konto auf
        Free chattet auch im Terminal nur mit einem{" "}
        <Link href="/docs/eigene-api-keys">eigenen API-Key</Link>. Den Key kennt das Terminal nie, der
        Server benutzt ihn für dich. Ein Gespräch aus dem Terminal erscheint danach auch in deinen
        Chats im Browser.
      </p>

      <h2>Wie melde ich ein Terminal wieder ab?</h2>
      <p>
        Mit dem Abmelden im Terminal, oder in den <Link href="/settings#terminals">Einstellungen</Link>:
        dort stehen alle angemeldeten Terminals mit Name und Datum, und du meldest jedes einzeln ab. Beides
        beendet nur dieses eine Gerät, dein Browser und deine anderen Geräte bleiben angemeldet.
      </p>
      <p>
        <strong>Abmelden im Kontomenü beendet alle Sitzungen deines Kontos, auch alle Terminals.</strong>{" "}
        Löschst du dein Konto, ist jede Anmeldung eines Terminals ebenfalls sofort ungültig.
      </p>

      <h2>Was ändert sich mit einem zweiten Faktor?</h2>
      <p>
        Ein Terminal anzumelden verlangt dann den Code aus deiner Authenticator-App. Das Terminal selbst fragt nicht
        danach, und seine Anmeldung darf weder dein Passwort ändern noch weitere Terminals anmelden. Jede neue Anmeldung
        im Browser mit zweitem Faktor meldet deine Terminals ab: das macht der Anmeldedienst so, und du meldest sie danach
        neu an.
      </p>

      <h2>Wie lange bleibt ein Terminal angemeldet?</h2>
      <p>
        Höchstens 30 Tage. Danach meldest du es neu an, mit einem neuen Code. Die Frist lässt sich nicht
        verlängern, auch nicht durch Benutzung.
      </p>

      <h2>Was bleibt ein Risiko?</h2>
      <p>
        Die Anmeldung eines Terminals liegt auf dem Rechner, an dem du sie ausgestellt hast. Sie ist so viel
        wert wie dein Browser: wer Zugriff auf diese Datei hat, kann als du chatten und deine Chats und
        Projekte lesen, bis du das Terminal abmeldest, die 30 Tage um sind oder du das Konto löschst. Nach dem
        Abmelden gilt ein schon ausgestelltes Zugangstoken beim Datenbankdienst noch bis zu einer Stunde. Melde
        ein Terminal ab, wenn du den Rechner abgibst.
      </p>

      <h2>Was speichert PromptPrinter dabei?</h2>
      <p>
        Für die Anmeldung eine kurze Anfrage mit dem Gerätenamen, Adresse, ungefährem Ort, Programm, den
        Zeitpunkten und dem Ausgang (bestätigt, abgelehnt, abgeholt). Der Code, mit dem das Terminal seine
        Anmeldung abholt, wird nur als Prüfwert gespeichert. Eine Anfrage wird spätestens einen Tag nach ihrem
        Ablauf gelöscht. Für jedes angemeldete Terminal bleiben Gerätename und Zeitpunkte, bis es abgemeldet oder
        abgelaufen ist. Dass ein Terminal angemeldet oder abgemeldet wurde, steht ohne Gerätename im
        Sicherheitsprotokoll. Mehr steht in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </DocsShell>
  );
}

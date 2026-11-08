import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import { docMetadata } from "@/features/marketing/lib/article-metadata";

const doc = docBySlug("terminal-anmeldung")!;

export const metadata: Metadata = docMetadata(doc);

// Die Befehle folgen dem Repo `promptprinter-cli` (README). Das Paket liegt noch nicht auf npm, deshalb zeigt die
// Seite den Weg aus dem Quellcode und keinen `npm install`: ein fremdes Paket gleichen Namens soll niemand wegen
// dieser Seite installieren. Nach der Veröffentlichung kommen `npm install -g promptprinter`, `npx promptprinter`
// und die Einrichtung mit `npx -y promptprinter mcp` hierher, zusammen mit `updated` in docs-nav.ts.
const REPO_URL = "https://github.com/BajKasum/promptprinter-cli";
const ENTRY = "/pfad/zu/promptprinter-cli/bin/promptprinter.mjs";
const DESKTOP_CONFIG = JSON.stringify(
  { mcpServers: { promptprinter: { command: "node", args: [ENTRY, "mcp"] } } },
  null,
  2
);

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Terminal und MCP"
      intro="PromptPrinter gibt es auch als Programm fürs Terminal. Du meldest es einmal im Browser an, ohne ein Passwort einzutippen, und schreibst danach deine Prompts direkt in der Kommandozeile oder lässt sie von einer anderen KI holen."
    >
      <h2>Was brauche ich?</h2>
      <p>
        Node 22 oder neuer und ein Konto bei PromptPrinter. Das Programm heisst <code>promptprinter</code> und
        hat keine weiteren Abhängigkeiten. Es liegt noch nicht auf npm, du holst es dir von{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        :
      </p>
      <pre>
        <code>{`git clone ${REPO_URL}.git\ncd promptprinter-cli\nnode bin/promptprinter.mjs`}</code>
      </pre>
      <p>
        Ein Konto auf Free chattet auch im Terminal nur mit einem{" "}
        <Link href="/docs/eigene-api-keys">eigenen API-Key</Link>. Den hinterlegst du in den{" "}
        <Link href="/settings">Einstellungen</Link> im Browser, das Terminal kennt ihn nie: der Server benutzt
        ihn für dich.
      </p>

      <h2>Wie melde ich das Terminal an?</h2>
      <ol>
        <li>
          Du startest das Programm. Es fragt den Server nach einem Code und zeigt ihn an: acht Zeichen, zum
          Beispiel <code>BCDF-GHJK</code>. Dazu schickt es den Namen des Geräts.
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
          Das Terminal holt danach einmal seine eigene Anmeldung ab. Der Code gilt zehn Minuten und nur ein
          einziges Mal. Ein Passwort tippst du im Terminal nie ein.
        </li>
      </ol>

      <h2>Wann bestätige ich?</h2>
      <p>
        Nur, wenn du den Befehl im Terminal gerade selbst gestartet hast. Wer dir einen Code schickt und dich
        bittet, ihn zu bestätigen, will sich in dein Konto einloggen. Der Code steht deshalb nie in einem Link,
        den du anklicken könntest: du tippst ihn ab, damit du ihn nur bestätigst, wenn er auf deinem eigenen
        Bildschirm steht.
      </p>

      <h2>Was tippe ich im Programm?</h2>
      <ul>
        <li>
          <code>/pp &lt;Idee&gt;</code>: ein neuer Prompt. Wie im Chat im Browser kommt erst eine kurze
          Rückfrage, dann der fertige Prompt.
        </li>
        <li>
          <code>/pp --kontext &lt;Idee&gt;</code>: dazu liest das Programm das Projekt im aktuellen Ordner. Du
          siehst vorher, was mitgeht und wohin, und erst ein getipptes <code>j</code> sendet es.
        </li>
        <li>
          <code>/copy</code>: der letzte Prompt in die Zwischenablage.
        </li>
        <li>
          <code>/save</code>: der letzte Prompt landet bei deinen{" "}
          <Link href="/docs/ergebnisse">gespeicherten Prompts</Link>, auch im Browser.
        </li>
        <li>
          <code>/an claude</code> und <code>/an codex</code>: startet Claude Code oder Codex im selben
          Terminal, mit dem fertigen Prompt als erster Nachricht. Das geht nur, wenn das jeweilige Programm
          auf deinem Rechner installiert ist.
        </li>
      </ul>
      <p>Ein Gespräch aus dem Terminal erscheint danach auch in deinen Chats im Browser.</p>

      <h2>Wie nutze ich PromptPrinter über MCP?</h2>
      <p>
        Mit <code>promptprinter mcp</code> läuft das Programm als MCP-Server über die Standardein- und
        -ausgabe. Eine andere KI, zum Beispiel Claude Code oder Claude Desktop, bekommt damit drei Werkzeuge:
      </p>
      <ul>
        <li>
          <code>create_prompt</code>: aus einer Idee wird ein fertiger Prompt. Fehlt etwas Wichtiges, sagt die
          Antwort, was.
        </li>
        <li>
          <code>list_saved_prompts</code>: zeigt deine gespeicherten Prompts, neueste zuerst, auf Wunsch nach
          einem Suchwort gefiltert.
        </li>
        <li>
          <code>get_saved_prompt</code>: holt einen gespeicherten Prompt im vollen Wortlaut.
        </li>
      </ul>
      <p>
        Vorher startest du das Programm einmal normal und meldest es an: der MCP-Server benutzt dieselbe
        Anmeldung und fragt selbst nach keinem Code. In Claude Code richtest du ihn mit einem Befehl ein, den
        Pfad ersetzt du durch den Ordner, in den du das Repo geklont hast:
      </p>
      <pre>
        <code>{`claude mcp add promptprinter -- node ${ENTRY} mcp`}</code>
      </pre>
      <p>
        In Claude Desktop trägst du ihn in die Datei <code>claude_desktop_config.json</code> ein:
      </p>
      <pre>
        <code>{DESKTOP_CONFIG}</code>
      </pre>

      <h2>Was darf das Terminal?</h2>
      <p>
        Es hat dasselbe Konto wie dein Browser und gilt für dieselben Grenzen: dein Plan, die Limits und die
        Zustimmung zur Übermittlung an Z.ai sind dieselben wie im Chat im Browser. Über MCP liest es deine
        gespeicherten Prompts, ändern oder löschen kann es sie nicht.
      </p>

      <h2>Wie melde ich ein Terminal wieder ab?</h2>
      <p>
        Mit <code>promptprinter logout</code> (aus dem Quellcode: <code>node bin/promptprinter.mjs logout</code>)
        oder in den <Link href="/settings#terminals">Einstellungen</Link>: dort stehen alle angemeldeten
        Terminals mit Name und Datum, und du meldest jedes einzeln ab. Beides beendet nur dieses eine Gerät,
        dein Browser und deine anderen Geräte bleiben angemeldet.
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
        wert wie dein Browser: wer Zugriff auf diese Datei hat, kann als du chatten und deine Chats, Projekte
        und gespeicherten Prompts lesen, bis du das Terminal abmeldest, die 30 Tage um sind oder du das Konto
        löschst. Dasselbe gilt für jede KI, der du den MCP-Server gibst. Nach dem Abmelden gilt ein schon
        ausgestelltes Zugangstoken beim Datenbankdienst noch bis zu einer Stunde. Melde ein Terminal ab, wenn
        du den Rechner abgibst.
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

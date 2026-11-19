import type { Metadata } from "next";
import Link from "next/link";
import { DocsShell } from "@/features/marketing/components/docs-shell";
import { docBySlug } from "@/shared/lib/docs-nav";
import { docMetadata } from "@/features/marketing/lib/article-metadata";
import { LICENSE_URL, REPO_URL, SELF_HOSTING_GUIDE_URL } from "@/features/marketing/lib/open-source";
import {
  SELF_HOSTING_APP_URL,
  SELF_HOSTING_ENV_COPY,
  SELF_HOSTING_ENV_LINES,
  SELF_HOSTING_MODEL_COMMAND,
  SELF_HOSTING_SETUP_COMMANDS,
  SELF_HOSTING_START_COMMAND,
} from "@/features/marketing/lib/self-hosting";

const doc = docBySlug("selbst-betreiben")!;

export const metadata: Metadata = docMetadata(doc);

// Die Kurzfassung von docs/SETUP.md, "Selbst betreiben", für Leute, die PromptPrinter mit Ollama auf dem eigenen
// Rechner wollen. Die Befehle kommen aus features/marketing/lib/self-hosting.ts, ein Test gleicht sie mit der
// Anleitung ab. Alles Weitere (Docker, Reverse Proxy, Zeitgrenzen) steht nur dort, der Artikel verlinkt es.

const DOCKER_GUIDE_URL = SELF_HOSTING_GUIDE_URL.replace("#selbst-betreiben", "#mit-docker");

export default function Page() {
  return (
    <DocsShell
      slug={doc.slug}
      title="Selbst betreiben"
      intro="PromptPrinter ist Open Source. Du kannst die ganze App auf deinem eigenen Rechner laufen lassen, mit einem freien Modell über Ollama. Deine Chats gehen dann an keinen fremden Dienst, auch nicht an promptprinter.app."
    >
      <h2>Was brauche ich?</h2>
      <ul>
        <li>
          <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">
            Ollama
          </a>{" "}
          für das Modell. Jeder andere Server mit der Chat-Schnittstelle von OpenAI geht auch, zum Beispiel LM
          Studio.
        </li>
        <li>Node 24 und Git.</li>
        <li>Docker, für die Datenbank: sie läuft als lokaler Supabase-Stack auf deinem Rechner.</li>
      </ul>
      <p>
        Der Code liegt auf{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        , unter der{" "}
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
          MIT-Lizenz
        </a>
        . Ausgenommen sind der Name, das Logo und die Bilder von Finn.
      </p>

      <h2>Wie richte ich es ein?</h2>
      <ol>
        <li>
          Ein Modell holen. Ollama hört danach auf <code>http://localhost:11434</code>.
          <pre>
            <code>{SELF_HOSTING_MODEL_COMMAND}</code>
          </pre>
        </li>
        <li>
          Den Code holen und die Datenbank starten. Der letzte Befehl zeigt <code>ANON_KEY</code> und{" "}
          <code>SERVICE_ROLE_KEY</code>, die du gleich brauchst.
          <pre>
            <code>{SELF_HOSTING_SETUP_COMMANDS.join("\n")}</code>
          </pre>
        </li>
        <li>
          Die Vorlage kopieren:
          <pre>
            <code>{SELF_HOSTING_ENV_COPY}</code>
          </pre>
          In <code>.env.local</code> trägst du diese Zeilen ein, die übrigen der Vorlage bleiben leer:
          <pre>
            <code>{SELF_HOSTING_ENV_LINES.join("\n")}</code>
          </pre>
        </li>
        <li>
          Starten, dann <code>{SELF_HOSTING_APP_URL}</code> öffnen, ein Konto anlegen und chatten:
          <pre>
            <code>{SELF_HOSTING_START_COMMAND}</code>
          </pre>
        </li>
      </ol>
      <p>
        Das Konto liegt in deiner eigenen Datenbank, eine Bestätigungsmail gibt es dort nicht. Gebaut statt im
        Entwicklungsmodus, mit Docker oder hinter einem Reverse Proxy: das steht in der{" "}
        <a href={SELF_HOSTING_GUIDE_URL} target="_blank" rel="noopener noreferrer">
          ausführlichen Anleitung
        </a>{" "}
        (für Docker im Abschnitt{" "}
        <a href={DOCKER_GUIDE_URL} target="_blank" rel="noopener noreferrer">
          Mit Docker
        </a>
        ).
      </p>

      <h2>Was ist dann anders als auf promptprinter.app?</h2>
      <ul>
        <li>
          <code>SELF_HOSTED=1</code> schaltet den Betrieb in einem Prozess ein. Jedes Konto chattet auf deinem
          Modell, ohne die Grenze der drei Gratis-Prompts und ohne eigenen Key. Ein Stundenlimit je Konto bleibt.
        </li>
        <li>
          Wer sich registriert, chattet auf deinem Modell. Steht deine Installation im Internet, schaltest du die
          Registrierung ab, sobald deine eigenen Konten angelegt sind.
        </li>
        <li>
          Keine Mensch-Prüfung bei der Anmeldung und kein Kontaktformular, solange du die Dienste dafür nicht
          einträgst. Für den Betrieb im Netz gehört TLS davor.
        </li>
        <li>
          Wie gut die Prompts werden, hängt am Modell. Ein Modell mit Denkmodus (wie qwen3) kann seinen Denktext im
          Chat zeigen; dann ein Modell ohne Denkmodus nehmen oder das Denken am Server abschalten.
        </li>
      </ul>

      <h2>Geht es auch ohne Datenbank?</h2>
      <p>
        Im Terminal, ja. Das Programm <code>promptprinter</code> läuft mit <code>--local</code> ohne Konto und
        ohne Datenbank direkt an deinem Ollama. Wie du es holst und startest, steht unter{" "}
        <Link href="/terminal">CLI</Link>.
      </p>

      <h2>Was ist nicht geprüft?</h2>
      <p>
        Der Weg ist im Browser durchgespielt, gegen einen Server, der die Schnittstelle von Ollama nachbildet,
        nicht gegen ein echtes Ollama. Wie gut Finns Prompts mit einem kleinen Modell auf deinem Rechner werden,
        ist nicht gemessen. Geht etwas schief, schreib es als{" "}
        <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
          Issue auf GitHub
        </a>
        .
      </p>
    </DocsShell>
  );
}

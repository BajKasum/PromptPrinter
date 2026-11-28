import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RESEND_KEY } from "./fakes.cjs";

// Wie die Ende-zu-Ende-Tests an ihre Umgebung kommen, und die eine Sperre, die
// sie von der Produktion fernhält (Betriebs-Audit, M1/M2).
//
// Die Tests laufen gegen den lokalen Supabase-Stack (supabase start), nie gegen
// ein gehostetes Projekt. Das ist keine Konvention, sondern wird hier erzwungen:
// ein Test, der ein Konto anlegt, Daten schreibt und es wieder löscht, darf
// nicht aus Versehen in die Produktionsdatenbank schreiben, nur weil
// `.env.local` auf sie zeigt. Vorschau-Deployments teilen sich ja heute schon
// die Produktions-Datenbank, genau das soll sich hier nicht wiederholen.

export type LocalSupabase = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** Wirft, wenn die Adresse nicht der lokale Rechner ist. */
export function assertLocalUrl(raw: string): string {
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error(`E2E: "${raw}" ist keine gültige Adresse.`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `E2E läuft nur gegen den lokalen Supabase-Stack (127.0.0.1 oder localhost), ` +
        `nicht gegen "${host}". Die Tests legen Konten an und löschen sie wieder.`
    );
  }
  return raw;
}

/** `KEY="value"`-Zeilen aus `supabase status -o env`. */
export function parseStatusEnv(output: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/);
    if (match) result[match[1]] = match[2] ?? match[3] ?? "";
  }
  return result;
}

let cached: LocalSupabase | undefined;

/**
 * Adresse und Schlüssel des lokalen Stacks.
 *
 * Aus E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY / E2E_SUPABASE_SERVICE_ROLE_KEY,
 * wenn gesetzt (die CI schreibt sie aus `supabase status`), sonst direkt von der
 * CLI. Die Schlüssel sind die öffentlich bekannten Demo-Schlüssel des lokalen
 * Stacks und stehen deshalb nicht im Repository, sondern werden zur Laufzeit
 * gelesen: ein Geheimnis-Scanner soll sie gar nicht erst finden müssen.
 */
export function localSupabase(): LocalSupabase {
  if (cached) return cached;

  let { E2E_SUPABASE_URL: url, E2E_SUPABASE_ANON_KEY: anonKey, E2E_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } =
    process.env;

  if (!url || !anonKey || !serviceRoleKey) {
    const cli = process.env.E2E_SUPABASE_CLI ?? "supabase";
    let output: string;
    try {
      output = execSync(`${cli} status -o env`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      throw new Error(
        "E2E: der lokale Supabase-Stack antwortet nicht. Erst `supabase start` ausführen " +
          "(oder E2E_SUPABASE_CLI auf den Aufruf der CLI setzen, z. B. " +
          '"npx --yes supabase@2.119.0"). Siehe docs/SETUP.md, Abschnitt "Ende-zu-Ende-Tests". ' +
          `Ursache: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
      );
    }
    const status = parseStatusEnv(output);
    url ??= status.API_URL;
    anonKey ??= status.ANON_KEY;
    serviceRoleKey ??= status.SERVICE_ROLE_KEY;
  }

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("E2E: URL oder Schlüssel des lokalen Supabase-Stacks fehlen.");
  }

  cached = { url: assertLocalUrl(url), anonKey, serviceRoleKey };
  return cached;
}

/**
 * Ein Secret je Testlauf, nie im Repository. Playwright lädt diese Datei im Hauptprozess und in jedem Worker: der erste
 * Aufruf legt den Wert in der Umgebung ab, die Worker erben ihn, so sehen Server und Test denselben.
 */
function runSecret(name: string): string {
  process.env[name] ||= randomBytes(32).toString("base64url");
  return process.env[name];
}

/** Port des Next-Servers der Tests, bewusst nicht 3000: dort läuft oft der eigene Dev-Server. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;

/** Die Variablen, die eine Vorlage wie .env.example nennt, auch die auskommentierten, jede einmal. */
export function templateVariables(template: string): string[] {
  const names = [...template.matchAll(/^[ \t]*(?:#[ \t]*)?([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
  return [...new Set(names)];
}

/**
 * Was ebenfalls leer sein muss, aber nicht in .env.example steht: eine Variable, die der Code liest, und `VERCEL`, das
 * `vercel env pull` in eine `.env.local` schreibt. tests/guards/e2e-env.test.ts hält fest, dass der Code sonst nichts
 * Unbekanntes liest.
 */
export const NOT_IN_TEMPLATE = ["FREE_TRIAL_DAILY_CALLS", "VERCEL"];

/**
 * Liest das OpenAI-SDK selbst aus der Umgebung, nicht der Code der App, steht also in keiner Vorlage: eine andere
 * Basisadresse führte am Stellvertreter vorbei an diesen Host, eigene Köpfe könnten den Key ersetzen.
 */
const SDK_OVERRIDES = { OPENAI_BASE_URL: "", OPENAI_CUSTOM_HEADERS: "" };

/**
 * Alles, was die Vorlage nennt, leer. Next lädt zusätzlich `.env.local`, wo auf einem Entwicklerrechner echte
 * Zugangsdaten und Schalter stehen können; ein im Prozess GESETZTER Wert, auch ein leerer, schlägt die Datei. Aus der
 * Vorlage gelesen, damit eine neue Variable nicht vergessen wird: ohne Eintrag unten bleibt sie in den Tests aus.
 */
function blankedTemplate(): Record<string, string> {
  const template = readFileSync(join(process.cwd(), ".env.example"), "utf8");
  return Object.fromEntries([...templateVariables(template), ...NOT_IN_TEMPLATE].map((name) => [name, ""]));
}

/**
 * Das Protokoll der Stellvertreter (support/outbound-fakes.cjs): eine Zeile je Anfrage an einen der nachgestellten
 * Dienste. Eine Datei je Testlauf, Haupt- und Worker-Prozesse sehen dieselbe.
 */
export function outboundLogPath(): string {
  return join(tmpdir(), `pp-e2e-outbound-${runSecret("E2E_RUN_ID")}.jsonl`);
}

/** `--require` in NODE_OPTIONS, hinter dem, was schon gesetzt ist. Next reicht die Optionen an seine Prozesse weiter. */
function nodeOptionsWithFakes(): string {
  const preload = join(process.cwd(), "e2e/support/outbound-fakes.cjs").replaceAll("\\", "/");
  const flag = preload.includes(" ") ? `--require "${preload}"` : `--require ${preload}`;
  return [process.env.NODE_OPTIONS, flag].filter(Boolean).join(" ");
}

/**
 * Die Umgebung des Next-Servers der Tests, vollständig und ausdrücklich.
 *
 * Ausgangspunkt ist jede Variable aus .env.example, leer (blankedTemplate): kein Server-Modell (Chat im
 * Stub-Modus), kein eigener Endpunkt, kein Einzelbetrieb, kein Upstash (Ratenlimit im Speicher), kein Captcha,
 * kein Alarm-Webhook, kein GitHub-Token. Gesetzt wird nur, was darunter steht. GitHub, OpenAI und Resend
 * erreicht der Server nie: ihre Anfragen beantworten die Stellvertreter (support/fakes.cjs), deshalb darf
 * RESEND_API_KEY ihren Wert tragen. Dass die leeren Werte greifen, prüft e2e/smoke.spec.ts, die Stellvertreter
 * prüft tests/guards/e2e-fakes.test.ts.
 */
export function serverEnv(): Record<string, string> {
  return {
    ...sharedServerEnv(E2E_ORIGIN),
    ...SDK_OVERRIDES,
    NODE_ENV: "development",
    // Schaltet Nexts Dev-Anzeige aus (next.config.ts): sie läge links unten über dem Kontomenü, sobald sie einen Hinweis zählt.
    PP_E2E: "1",
    RESEND_API_KEY: RESEND_KEY,
    NODE_OPTIONS: nodeOptionsWithFakes(),
    E2E_OUTBOUND_LOG: outboundLogPath(),
  };
}

/** Port und Adresse des Produktions-Servers (playwright.prod.config.ts), neben dem Dev-Server der Tests. */
export const E2E_PROD_PORT = Number(process.env.E2E_PROD_PORT ?? 3101);
export const E2E_PROD_ORIGIN = `http://localhost:${E2E_PROD_PORT}`;

/**
 * Die Umgebung des Produktions-Servers (`next build` und `next start`), ausdrücklich wie `serverEnv()`.
 *
 * NODE_ENV ist "production": dort gilt die Policy ohne `'unsafe-eval'`, env.ts verlangt seine Pflichtvariablen und
 * der Stub-Chat ist gesperrt. Upstash bekommt Platzhalter wie in docker.yml (der Start verlangt sie, ein Aufruf
 * von /api/health prüft nur, dass sie da sind); wer eine API-Route anspricht, die das Ratenlimit braucht, bekäme in
 * Produktion eine 429, deshalb meldet sich dieser Test über Cookies an und nicht über /api/auth. Die Adresse ist
 * http: ALLOW_INSECURE_APP_URL=1 ist der dokumentierte Weg für einen lokalen Versuch (docs/DOCKER.md).
 */
export function prodServerEnv(): Record<string, string> {
  return {
    ...sharedServerEnv(E2E_PROD_ORIGIN),
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://placeholder.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "placeholder-token-for-e2e-only",
    ALLOW_INSECURE_APP_URL: "1",
    PORT: String(E2E_PROD_PORT),
  };
}

/** Was beide Server gemeinsam haben: lokale Datenbank, alle fremden Dienste aus. */
function sharedServerEnv(origin: string): Record<string, string> {
  const supabase = localSupabase();
  return {
    ...blankedTemplate(),
    NEXT_PUBLIC_SUPABASE_URL: supabase.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    NEXT_PUBLIC_APP_URL: origin,
    // Damit signIn() je Konto eine eigene Adresse nennen kann (e2e/support/fixtures.ts).
    TRUSTED_PROXY_HOPS: "1",
    API_KEY_ENCRYPTION_SECRET: runSecret("E2E_BYOK_SECRET"),
  };
}

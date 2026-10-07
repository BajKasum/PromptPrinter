import { execSync } from "node:child_process";

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
 * Signing-Secret des Webhook-Tests (e2e/billing-webhook.spec.ts), ein Wert nur für diesen
 * Test: der Next-Server der Tests und der Test selbst lesen ihn von hier, das echte Secret
 * aus dem Lemon-Squeezy-Dashboard kommt nirgends vor. Er schaltet nichts frei, was ein
 * Fremder nutzen könnte: der Server lauscht nur auf localhost und schreibt in den lokalen
 * Stack.
 */
export const E2E_WEBHOOK_SECRET = "e2e-only-webhook-signing-secret-0123456789";

/** Port des Next-Servers der Tests, bewusst nicht 3000: dort läuft oft der eigene Dev-Server. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;

/**
 * Die Umgebung des Next-Servers der Tests, vollständig und ausdrücklich.
 *
 * Next lädt zusätzlich `.env.local`, wo auf einem Entwicklerrechner echte
 * Zugangsdaten stehen können. Ein im Prozess GESETZTER Wert, auch ein leerer,
 * schlägt die Datei. Darum stehen hier alle Dienste, die der Test nicht nutzen
 * darf, ausdrücklich auf leer: kein Modell-Anbieter (Chat im Stub-Modus), kein
 * Upstash (Ratenlimit im Speicher), kein Captcha, kein Zahlungsanbieter, kein
 * Alarm-Webhook, kein GitHub-Token. Ein Test (e2e/smoke.spec.ts) prüft, dass das
 * greift.
 */
export function serverEnv(): Record<string, string> {
  const supabase = localSupabase();
  return {
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: supabase.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
    NEXT_PUBLIC_APP_URL: E2E_ORIGIN,
    API_KEY_ENCRYPTION_SECRET: "e2e-only-secret-used-by-nothing-else-0123456789",
    API_KEY_ENCRYPTION_SECRET_PREVIOUS: "",
    ZAI_API_KEY: "",
    ZAI_MODEL: "",
    ZAI_VISION_MODEL: "",
    GEMINI_API_KEY: "",
    GEMINI_MODEL: "",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET: "",
    NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL: "",
    // Kein Checkout und kein Lemon-Squeezy-Konto, aber der Webhook lauscht: der Test
    // schickt selbst signierte Ereignisse (e2e/billing-webhook.spec.ts).
    LEMON_SQUEEZY_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
    LEMON_SQUEEZY_API_KEY: "",
    ALERT_WEBHOOK_URL: "",
    GITHUB_TOKEN: "",
    GOOGLE_SITE_VERIFICATION: "",
    BING_SITE_VERIFICATION: "",
  };
}

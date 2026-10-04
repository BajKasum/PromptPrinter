/**
 * Schlüsselt die gespeicherten BYOK-Keys (user_api_keys.encrypted_key) von
 * API_KEY_ENCRYPTION_SECRET_PREVIOUS auf API_KEY_ENCRYPTION_SECRET um.
 *
 * ─── Warum es das gibt ──────────────────────────────────────────────────────
 * Bis zum Betriebs-Audit vom 04.10.2026 hing jeder gespeicherte Nutzer-Key an
 * genau einem Secret. Wer es ändern wollte (Verdacht auf Abfluss, Mitarbeiter-
 * wechsel, Pflicht-Rotation), machte damit alle Keys unlesbar, und
 * getUserOverride() stuft einen unlesbaren Key stillschweigend auf "kein
 * eigener Key" zurück: jeder BYOK-Nutzer läuft dann unbemerkt auf dem Server-Key
 * und unter den Plan-Grenzen. crypto.ts liest deshalb während einer Rotation mit
 * beiden Secrets. Dieses Skript ist der zweite Schritt: es schreibt die Zeilen,
 * die nur das alte Secret öffnet, unter dem neuen neu, damit das alte danach
 * wirklich weg kann.
 *
 * ─── Ablauf einer Rotation ──────────────────────────────────────────────────
 *   1. Neues Secret erzeugen (lang, zufällig).
 *   2. In Vercel: API_KEY_ENCRYPTION_SECRET_PREVIOUS = altes Secret,
 *      API_KEY_ENCRYPTION_SECRET = neues Secret. Deployen. Ab jetzt öffnet die
 *      App beide, schreibt aber nur noch unter dem neuen.
 *   3. Dieses Skript im Probelauf (ohne --apply). Es zählt, schreibt nichts.
 *   4. Mit --apply umschlüsseln.
 *   5. Probelauf noch einmal: es muss "nur neues Secret" für alle Zeilen melden.
 *   6. API_KEY_ENCRYPTION_SECRET_PREVIOUS in Vercel löschen, deployen.
 *
 * Aufruf (die Werte stehen NICHT in einer .env-Datei, die das Skript liest:
 * eine Rotation soll nie versehentlich gegen die falsche Datenbank laufen,
 * deshalb muss man sie bewusst mitgeben):
 *
 *   SUPABASE_URL=https://<projekt>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   API_KEY_ENCRYPTION_SECRET=<neu> \
 *   API_KEY_ENCRYPTION_SECRET_PREVIOUS=<alt> \
 *   node scripts/rotate-byok-secret.mjs [--apply]
 *
 * Es gibt nie einen Key, ein Secret oder einen Chiffretext aus, nur Zahlen und
 * Zeilen-IDs. Jede Zeile wird vor dem Schreiben mit dem neuen Secret zurück-
 * gelesen, und geschrieben wird nur, solange der alte Chiffretext noch in der
 * Zeile steht (hat der Nutzer inzwischen neu gespeichert, bleibt sein Wert).
 *
 * Exit: 0 alles unter dem neuen Secret · 1 es sind Zeilen offen (Probelauf)
 *       oder ein Schreiben ist gescheitert · 2 falscher Aufruf/Datenbankfehler ·
 *       3 Zeilen, die KEIN Secret öffnet (der Nutzer muss den Key neu eingeben;
 *       das Skript löscht nie etwas).
 *
 * Die Verschlüsselung hier ist eine Kopie von src/server/security/crypto.ts
 * (AES-256-GCM, scrypt mit festem Salt, iv + Tag + Chiffretext als base64).
 * Eine Kopie, weil ein TypeScript-Modul mit `server-only` kein Skript-Import ist.
 * tests/guards/rotate-byok-secret.test.ts hält beide gegeneinander fest: ein
 * Blob aus dem einen muss das andere öffnen.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { pathToFileURL } from "node:url";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "promptprinter-byok";

export function deriveKey(secret) {
  return scryptSync(secret, SALT, 32);
}

export function encryptWith(secret, plaintext) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Klartext oder null (falsches Secret / beschädigter Blob). Wirft nie. */
export function decryptWith(secret, blob) {
  try {
    const raw = Buffer.from(blob, "base64");
    const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), raw.subarray(0, IV_LENGTH));
    decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + 16));
    return Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + 16)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * In welchem Zustand ist eine Zeile?
 *   "current"   das neue Secret öffnet sie, nichts zu tun
 *   "previous"  nur das alte öffnet sie, muss umgeschlüsselt werden
 *   "unreadable" keins von beiden
 * Das aktuelle Secret gewinnt immer: öffnet es die Zeile, ist sie fertig, egal
 * ob das alte sie auch öffnen würde.
 *
 * @returns {{ state: "current" | "previous" | "unreadable", plaintext?: string }}
 */
export function classify(blob, { current, previous }) {
  if (decryptWith(current, blob) !== null) return { state: "current" };
  const plaintext = previous ? decryptWith(previous, blob) : null;
  if (plaintext !== null) return { state: "previous", plaintext };
  return { state: "unreadable" };
}

const PAGE = 1000;

async function api(deps, path, init = {}) {
  const response = await deps.fetchImpl(`${deps.base}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: deps.serviceKey, authorization: `Bearer ${deps.serviceKey}`, ...init.headers },
  });
  if (!response.ok) {
    // Der Antworttext kann Zeilen enthalten: nur der Status geht in die Meldung.
    throw new Error(`Supabase antwortete ${response.status} auf ${init.method ?? "GET"} ${path.split("?")[0]}`);
  }
  return response;
}

async function loadRows(deps) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const response = await api(deps, "user_api_keys?select=id,encrypted_key&order=created_at.asc", {
      headers: { range: `${from}-${from + PAGE - 1}` },
    });
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * Der ganze Ablauf, ohne process.exit und mit einstellbarem fetch, damit ein
 * Test ihn gegen eine Fake-Datenbank laufen lassen kann. Gibt den Exit-Code
 * zurück (Bedeutung im Kopfkommentar).
 *
 * @param {{ apply?: boolean, base: string, serviceKey: string, current: string, previous: string,
 *           fetchImpl?: typeof fetch, log?: (line: string) => void, logError?: (line: string) => void }} options
 */
export async function run(options) {
  const { apply = false, current, previous, log = console.log, logError = console.error } = options;
  const deps = {
    base: options.base.replace(/\/+$/, ""),
    serviceKey: options.serviceKey,
    fetchImpl: options.fetchImpl ?? fetch,
  };

  const missing = [
    ["SUPABASE_URL", deps.base],
    ["SUPABASE_SERVICE_ROLE_KEY", deps.serviceKey],
    ["API_KEY_ENCRYPTION_SECRET", current],
    ["API_KEY_ENCRYPTION_SECRET_PREVIOUS", previous],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    logError(`rotate-byok-secret: fehlt: ${missing.join(", ")} (siehe Kopfkommentar).`);
    return 2;
  }
  if (previous === current) {
    logError("rotate-byok-secret: altes und neues Secret sind gleich, es gibt nichts umzuschlüsseln.");
    return 2;
  }

  let rows;
  try {
    rows = await loadRows(deps);
  } catch (error) {
    logError(`rotate-byok-secret: ${error instanceof Error ? error.message : error}`);
    return 2;
  }

  const result = { current: 0, previous: [], unreadable: [] };
  for (const row of rows) {
    const verdict = classify(row.encrypted_key, { current, previous });
    if (verdict.state === "current") result.current += 1;
    else if (verdict.state === "previous") result.previous.push({ ...row, plaintext: verdict.plaintext });
    else result.unreadable.push(row.id);
  }

  log(`Zeilen gesamt:        ${rows.length}`);
  log(`  nur neues Secret:   ${result.current}  (fertig)`);
  log(`  nur altes Secret:   ${result.previous.length}  (müssen umgeschlüsselt werden)`);
  log(`  von keinem lesbar:  ${result.unreadable.length}`);
  if (result.unreadable.length > 0) {
    log(`  Zeilen-IDs: ${result.unreadable.join(", ")} (Nutzer muss den Key neu eingeben)`);
  }

  let failed = 0;
  let written = 0;
  if (apply && result.previous.length > 0) {
    for (const row of result.previous) {
      const fresh = encryptWith(current, row.plaintext);
      // Vor dem Schreiben zurücklesen: ein Blob, den das neue Secret nicht
      // selbst öffnet, darf nie in die Datenbank.
      if (decryptWith(current, fresh) !== row.plaintext) {
        failed += 1;
        logError(`  Zeile ${row.id}: Rücklese-Probe fehlgeschlagen, nicht geschrieben.`);
        continue;
      }
      try {
        // Nur schreiben, solange noch der ALTE Chiffretext in der Zeile steht:
        // hat der Nutzer zwischendurch neu gespeichert, gewinnt sein Wert.
        const response = await api(
          deps,
          `user_api_keys?id=eq.${encodeURIComponent(row.id)}&encrypted_key=eq.${encodeURIComponent(row.encrypted_key)}&select=id`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json", prefer: "return=representation" },
            body: JSON.stringify({ encrypted_key: fresh }),
          }
        );
        const updated = await response.json();
        if (updated.length === 1) written += 1;
        else log(`  Zeile ${row.id}: inzwischen geändert, übersprungen (beim nächsten Lauf erneut).`);
      } catch (error) {
        failed += 1;
        logError(`  Zeile ${row.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
    log(`\numgeschlüsselt: ${written} · fehlgeschlagen: ${failed}`);
  } else if (!apply && result.previous.length > 0) {
    log("\nProbelauf, nichts geschrieben. Mit --apply umschlüsseln.");
  }

  if (failed > 0) return 1;
  if (result.unreadable.length > 0) return 3;
  if (apply) {
    log(
      '\nJetzt ohne --apply erneut prüfen. Erst wenn dort "nur altes Secret: 0" steht, ' +
        "API_KEY_ENCRYPTION_SECRET_PREVIOUS entfernen."
    );
    return 0;
  }
  if (result.previous.length > 0) return 1;
  log("\nFertig: das neue Secret öffnet jede Zeile. API_KEY_ENCRYPTION_SECRET_PREVIOUS kann entfernt werden.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await run({
    apply: process.argv.includes("--apply"),
    base: process.env.SUPABASE_URL ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    current: process.env.API_KEY_ENCRYPTION_SECRET ?? "",
    previous: process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS ?? "",
  });
  process.exit(code);
}

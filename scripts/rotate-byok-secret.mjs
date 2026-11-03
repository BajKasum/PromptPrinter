/**
 * Schlüsselt die gespeicherten BYOK-Keys (user_api_keys.encrypted_key) bei einer Rotation von
 * API_KEY_ENCRYPTION_SECRET um: das alte Secret steht in API_KEY_ENCRYPTION_SECRET_PREVIOUS, das neue in
 * API_KEY_ENCRYPTION_SECRET. Ablauf (docs/SETUP.md, "BYOK-Secret rotieren"):
 *   1. Neues Secret erzeugen (mindestens 32 Zeichen Zufall, siehe .env.example).
 *   2. In Vercel: PREVIOUS = altes Secret, API_KEY_ENCRYPTION_SECRET = neues Secret. Deployen. Ab jetzt öffnet
 *      die App beide, schreibt aber nur noch unter dem neuen.
 *   3. Dieses Skript im Probelauf (ohne --apply). Es zählt, schreibt nichts.
 *   4. Mit --apply umschlüsseln.
 *   5. Probelauf noch einmal: "offen: 0".
 *   6. PREVIOUS in Vercel löschen, deployen.
 *
 * Ohne PREVIOUS ist der Probelauf eine reine Prüfung: jede Zeile muss unter dem aktuellen Secret aufgehen.
 *
 * Warum überhaupt: getUserOverride() meldet einen Key, den das Secret nicht öffnet, als "unreadable", und der Chat
 * dieses Kontos wird abgelehnt. Eine Zeile bleibt also lesbar, bis sie umgeschlüsselt ist, und erst danach kann das
 * alte Secret wirklich weg.
 *
 * Aufruf (die Werte stehen NICHT in einer .env-Datei, die das Skript liest: es soll nie versehentlich gegen die
 * falsche Datenbank laufen, deshalb muss man sie bewusst mitgeben):
 *
 *   SUPABASE_URL=https://<projekt>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   API_KEY_ENCRYPTION_SECRET=<aktuell> \
 *   API_KEY_ENCRYPTION_SECRET_PREVIOUS=<alt, nur bei einer Rotation> \
 *   node scripts/rotate-byok-secret.mjs [--apply]
 *
 * Es gibt nie einen Key, ein Secret oder einen Chiffretext aus, nur Zahlen und Zeilen-IDs. Jede Zeile wird vor dem
 * Schreiben zurückgelesen, und geschrieben wird nur, solange der alte Chiffretext noch in der Zeile steht (hat der
 * Nutzer inzwischen neu gespeichert, bleibt sein Wert).
 *
 * Exit: 0 alles fertig · 1 es sind Zeilen offen (Probelauf) oder ein Schreiben ist gescheitert · 2 falscher
 *       Aufruf/Datenbankfehler · 3 Zeilen, die KEIN Secret öffnet (der Nutzer muss den Key neu eingeben; das Skript
 *       löscht nie etwas).
 *
 * Die Verschlüsselung hier ist eine Kopie von src/server/security/crypto.ts, weil ein TypeScript-Modul mit
 * `server-only` kein Skript-Import ist. tests/guards/rotate-byok-secret.test.ts hält beide gegeneinander fest: ein
 * Wert aus dem einen muss das andere öffnen. Wie die App liest das Skript nur `pp2.…`; ein Wert ohne das Präfix
 * zählt als von keinem lesbar.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const FORMAT_PREFIX = "pp2";
const HKDF_NO_SALT = Buffer.alloc(0);
const KEY_INFO = "promptprinter/byok/v2/aes-256-gcm";
const KID_INFO = "promptprinter/byok/v2/key-id";

/** Wie src/server/env.ts: darunter schlüsselt das Skript nicht um, sonst läge danach alles unter einem schwachen Wert. */
export const MIN_SECRET_LENGTH = 32;

const hkdf = (secret, info, length) => Buffer.from(hkdfSync("sha256", secret, HKDF_NO_SALT, info, length));

export const keyId = (secret) => hkdf(secret, KID_INFO, 4).toString("hex");

const additionalData = ({ user_id, provider }) => Buffer.from(`${user_id}|${provider}`, "utf8");

/** @param {{ user_id: string, provider: string }} row die Zeile, an die der Wert gebunden wird */
export function encryptWith(secret, plaintext, row) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, hkdf(secret, KEY_INFO, 32), iv);
  cipher.setAAD(additionalData(row));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  return `${FORMAT_PREFIX}.${keyId(secret)}.${payload}`;
}

/** Klartext oder null (fremdes Format, falsches Secret, fremde Zeile, beschädigter Wert). Wirft nie. */
export function decryptWith(secret, blob, row) {
  if (!blob.startsWith(`${FORMAT_PREFIX}.`)) return null;
  const [, kid, payload] = blob.split(".");
  if (kid !== keyId(secret)) return null;
  try {
    const raw = Buffer.from(payload ?? "", "base64url");
    const decipher = createDecipheriv(ALGORITHM, hkdf(secret, KEY_INFO, 32), raw.subarray(0, IV_LENGTH));
    decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    decipher.setAAD(additionalData(row));
    return Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * In welchem Zustand ist eine Zeile?
 *   "current"    das aktuelle Secret öffnet sie, nichts zu tun
 *   "open"       nur das alte Secret öffnet sie: muss umgeschlüsselt werden
 *   "unreadable" kein Secret öffnet sie
 *
 * @returns {{ state: "current" | "open" | "unreadable", plaintext?: string }}
 */
export function classify(row, { current, previous }) {
  if (decryptWith(current, row.encrypted_key, row) !== null) return { state: "current" };
  const plaintext = previous ? decryptWith(previous, row.encrypted_key, row) : null;
  return plaintext !== null ? { state: "open", plaintext } : { state: "unreadable" };
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
    const response = await api(deps, "user_api_keys?select=id,user_id,provider,encrypted_key&order=created_at.asc", {
      headers: { range: `${from}-${from + PAGE - 1}` },
    });
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/**
 * Der ganze Ablauf, ohne process.exit und mit einstellbarem fetch, damit ein Test ihn gegen eine Fake-Datenbank laufen
 * lassen kann. Gibt den Exit-Code zurück (Bedeutung im Kopfkommentar).
 *
 * @param {{ apply?: boolean, base: string, serviceKey: string, current: string, previous?: string,
 *           fetchImpl?: typeof fetch, log?: (line: string) => void, logError?: (line: string) => void }} options
 */
export async function run(options) {
  const { apply = false, current, previous = "", log = console.log, logError = console.error } = options;
  const deps = {
    base: options.base.replace(/\/+$/, ""),
    serviceKey: options.serviceKey,
    fetchImpl: options.fetchImpl ?? fetch,
  };

  const missing = [
    ["SUPABASE_URL", deps.base],
    ["SUPABASE_SERVICE_ROLE_KEY", deps.serviceKey],
    ["API_KEY_ENCRYPTION_SECRET", current],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    logError(`rotate-byok-secret: fehlt: ${missing.join(", ")} (siehe Kopfkommentar).`);
    return 2;
  }
  if (current.length < MIN_SECRET_LENGTH) {
    logError(`rotate-byok-secret: API_KEY_ENCRYPTION_SECRET ist kürzer als ${MIN_SECRET_LENGTH} Zeichen.`);
    return 2;
  }
  if (previous === current) {
    logError("rotate-byok-secret: altes und neues Secret sind gleich. Für eine reine Prüfung PREVIOUS weglassen.");
    return 2;
  }

  let rows;
  try {
    rows = await loadRows(deps);
  } catch (error) {
    logError(`rotate-byok-secret: ${error instanceof Error ? error.message : error}`);
    return 2;
  }

  const result = { current: 0, open: [], unreadable: [] };
  for (const row of rows) {
    const verdict = classify(row, { current, previous });
    if (verdict.state === "current") result.current += 1;
    else if (verdict.state === "open") result.open.push({ ...row, plaintext: verdict.plaintext });
    else result.unreadable.push(row.id);
  }

  log(`Zeilen gesamt:        ${rows.length}`);
  log(`  fertig:             ${result.current}`);
  log(`  offen:              ${result.open.length}  (nur unter dem alten Secret lesbar)`);
  log(`  von keinem lesbar:  ${result.unreadable.length}`);
  if (result.unreadable.length > 0) {
    log(`  Zeilen-IDs: ${result.unreadable.join(", ")} (Nutzer muss den Key neu eingeben)`);
  }

  let failed = 0;
  let written = 0;
  if (apply && result.open.length > 0) {
    for (const row of result.open) {
      const fresh = encryptWith(current, row.plaintext, row);
      // Vor dem Schreiben zurücklesen: ein Wert, den das aktuelle Secret nicht selbst öffnet, darf nie in die Datenbank.
      if (decryptWith(current, fresh, row) !== row.plaintext) {
        failed += 1;
        logError(`  Zeile ${row.id}: Rücklese-Probe fehlgeschlagen, nicht geschrieben.`);
        continue;
      }
      try {
        // Nur schreiben, solange noch der ALTE Chiffretext in der Zeile steht: hat der Nutzer zwischendurch neu
        // gespeichert, gewinnt sein Wert.
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
  } else if (!apply && result.open.length > 0) {
    log("\nProbelauf, nichts geschrieben. Mit --apply umschlüsseln.");
  }

  if (failed > 0) return 1;
  if (result.unreadable.length > 0) return 3;
  if (apply) {
    log('\nJetzt ohne --apply erneut prüfen. Erst wenn dort "offen: 0" steht, ist das alte Secret entbehrlich.');
    return 0;
  }
  if (result.open.length > 0) return 1;
  log("\nFertig: das aktuelle Secret öffnet jede Zeile.");
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

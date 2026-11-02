import "server-only";

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scryptSync } from "crypto";

// Verschlüsselt die API-Keys der Nutzer (BYOK, Einstellungen), bevor sie in die Datenbank gehen
// (user_api_keys.encrypted_key). AES-256-GCM: ein veränderter Chiffretext scheitert beim Entschlüsseln laut,
// statt still Unsinn zu liefern, der dann als API-Key an einen Anbieter ginge.
//
// API_KEY_ENCRYPTION_SECRET steht nur in der Umgebung des Servers, nie in der Datenbank und nie im Quelltext:
// auch ein vollständiger Abzug der Tabelle nützt ohne ihn nichts. Ohne den Wert gibt es keine Verschlüsselung,
// auch nicht in der Entwicklung (einen Wegwerfwert erzeugen: .env.example). Seine Stärke prüft env.ts beim Start.
//
// Ein gespeicherter Wert sieht so aus: `pp2.<kid>.<base64url(iv + tag + chiffretext)>`.
//   - Den Schlüssel leitet HKDF aus dem Secret ab, mit einem Kontexttext. Kein Passwort-KDF und kein Salz: das
//     Secret ist langer Zufall (env.ts), und dafür braucht HKDF beides nicht (RFC 5869, Abschnitt 3.1).
//   - `kid` nennt das Secret: vier Byte aus demselben HKDF, daraus lässt sich nichts zurückrechnen. So findet
//     decrypt() während einer Rotation das richtige Secret, ohne zu probieren.
//   - `user_id|provider` gehen als zusätzliche authentifizierte Daten ein. Ein Wert lässt sich nur in seiner
//     eigenen Zeile öffnen, ein Tausch zweier Chiffretexte in der Tabelle scheitert am Tag.
//
// scripts/rotate-byok-secret.mjs trägt eine Kopie davon, tests/guards/rotate-byok-secret.test.ts hält beide
// gegeneinander fest. Das Skript hebt auch alte Zeilen auf dieses Format.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // die für GCM empfohlene Länge
const TAG_LENGTH = 16;

const FORMAT_PREFIX = "pp2";
const HKDF_NO_SALT = Buffer.alloc(0);
const KEY_INFO = "promptprinter/byok/v2/aes-256-gcm";
const KID_INFO = "promptprinter/byok/v2/key-id";

/** Die Zeile, zu der ein Wert gehört. */
export type KeyBinding = { userId: string; provider: string };

function hkdf(secret: string, info: string, length: number): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, HKDF_NO_SALT, info, length));
}

const deriveKey = (secret: string) => hkdf(secret, KEY_INFO, 32);
const keyId = (secret: string) => hkdf(secret, KID_INFO, 4).toString("hex");
const additionalData = ({ userId, provider }: KeyBinding) => Buffer.from(`${userId}|${provider}`, "utf8");

function currentSecret(): string {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("API_KEY_ENCRYPTION_SECRET is not configured");
  return secret;
}

/**
 * Das alte Secret während einer Rotation, sonst null. Mit API_KEY_ENCRYPTION_SECRET_PREVIOUS liest decrypt() noch
 * Werte unter dem alten Secret, encrypt() schreibt schon unter dem neuen; scripts/rotate-byok-secret.mjs schlüsselt
 * den Rest um, danach kommt die Variable wieder weg. Ohne aktuelles Secret ist sie kein Ersatz dafür.
 */
function previousSecret(): string | null {
  const previous = process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS;
  const current = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!previous || !current || previous === current) return null;
  return previous;
}

/** Verschlüsselt `plaintext` für genau diese Zeile. Das Ergebnis gehört nach `encrypted_key`. */
export function encrypt(plaintext: string, binding: KeyBinding): string {
  const secret = currentSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  cipher.setAAD(additionalData(binding));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  return `${FORMAT_PREFIX}.${keyId(secret)}.${payload}`;
}

function openWith(key: Buffer, raw: Buffer, aad?: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(0, IV_LENGTH));
  decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
  if (aad) decipher.setAAD(aad);
  return Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString("utf8");
}

function decryptBound(blob: string, binding: KeyBinding): string {
  const [, kid, payload] = blob.split(".");
  const secret = [currentSecret(), previousSecret()].find((candidate) => candidate && keyId(candidate) === kid);
  if (!secret) throw new Error("no configured secret matches this key id");
  return openWith(deriveKey(secret), Buffer.from(payload ?? "", "base64url"), additionalData(binding));
}

// ─── Das alte Format, nur noch zum Lesen ───────────────────────────────────
// base64(iv + tag + chiffretext), Schlüssel per scrypt mit festem Salz, ohne Bindung an die Zeile. Bleibt, bis
// scripts/rotate-byok-secret.mjs für die Produktion "altes Format: 0" meldet (docs/SETUP.md, "BYOK-Secret rotieren").
// Ein alter Wert enthält nie einen Punkt, das Base64-Alphabet kennt keinen: die Formate lassen sich nicht verwechseln.
const LEGACY_SCRYPT_SALT = "promptprinter-byok";

// scrypt braucht je Aufruf Dutzende Millisekunden Rechenzeit. Bleibt im Speicher, wird nie geloggt.
const legacyKeys = new Map<string, Buffer>();

function legacyKey(secret: string): Buffer {
  let key = legacyKeys.get(secret);
  if (!key) {
    key = scryptSync(secret, LEGACY_SCRYPT_SALT, 32);
    legacyKeys.set(secret, key);
  }
  return key;
}

function decryptLegacy(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  try {
    return openWith(legacyKey(currentSecret()), raw);
  } catch (error) {
    const previous = previousSecret();
    if (!previous) throw error;
    try {
      return openWith(legacyKey(previous), raw);
    } catch {
      throw error;
    }
  }
}

/**
 * Macht `encrypt` rückgängig. Wirft bei falschem Secret, veränderten Daten oder einer fremden Zeile (Tag von GCM).
 * Jeder Wurf heisst: dieser Key ist nicht verwendbar, kein Versuch, einen Teil zu retten.
 */
export function decrypt(blob: string, binding: KeyBinding): string {
  return blob.startsWith(`${FORMAT_PREFIX}.`) ? decryptBound(blob, binding) : decryptLegacy(blob);
}

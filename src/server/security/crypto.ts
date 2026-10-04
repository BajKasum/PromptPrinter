import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Encrypts user-supplied AI provider API keys (BYOK, settings) before they
// hit the database, see supabase/migrations/0015_user_api_keys.sql. AES-256-
// GCM: authenticated encryption, so a tampered ciphertext fails loudly on
// decrypt instead of silently returning garbage that gets sent to a provider
// as someone's API key.
//
// API_KEY_ENCRYPTION_SECRET is a server-only env var, never in the database,
// even a full DB dump of user_api_keys yields nothing usable without it.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM's recommended nonce length
const SALT = "promptprinter-byok"; // fixed, non-secret, scrypt still needs *a* salt

// Resolved once at module load, same convention as rate-limit.ts's own
// isProduction — tests exercise a change via vi.resetModules() + a dynamic
// re-import (see crypto.test.ts), not a per-call env read.
const isProduction = process.env.NODE_ENV === "production";

// DEV-ONLY fallback key material, reached only when isProduction is false (see
// getKey() below) — production keeps throwing exactly as before. A FIXED
// string, not something generated at process start: a random per-boot secret
// would make a BYOK key saved before a dev-server restart undecryptable after
// one, trading a missing-config error for a silent-corruption one. Anyone with
// read access to this repository already has this value, which is precisely
// why it must never be reachable once real user data exists — the throw below
// is what guarantees that, not obscurity.
const DEV_FALLBACK_SECRET =
  "promptprinter-dev-only-insecure-fallback-do-not-use-in-production";

let warnedDevFallback = false;

// scrypt is deliberately slow (tens of milliseconds of CPU). getKey() used to
// derive on EVERY call, i.e. once per chat turn of every BYOK user, for a value
// that only changes when the secret does. Keyed by the secret itself, so a test
// (or a rotation) that swaps the env var is still honoured on the next call.
// Kept in memory only, never logged or serialised.
const derivedKeys = new Map<string, Buffer>();

function deriveKey(secret: string): Buffer {
  let key = derivedKeys.get(secret);
  if (!key) {
    key = scryptSync(secret, SALT, 32);
    derivedKeys.set(secret, key);
  }
  return key;
}

/**
 * The previous secret during a rotation, or null when none is in progress.
 *
 * Rotating API_KEY_ENCRYPTION_SECRET used to be impossible: every stored key was
 * encrypted under the one secret, so changing it made all of them unreadable —
 * and getUserOverride degrades an unreadable key to "no override", i.e. silently
 * drops every BYOK user back onto the server's key and its plan limits. With
 * API_KEY_ENCRYPTION_SECRET_PREVIOUS set, decrypt() still reads the old rows
 * while encrypt() already writes under the new secret; scripts/rotate-byok-secret.mjs
 * then re-encrypts what is left, after which the variable is removed again.
 *
 * Ignored when it equals the current secret (nothing to fall back to) and
 * outside a real secret setup: the dev fallback is not a rotation partner.
 */
function previousKey(): Buffer | null {
  const previous = process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS;
  const current = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!previous || !current || previous === current) return null;
  return deriveKey(previous);
}

function getKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  // scrypt derives a proper 32-byte key regardless of the secret's own length/
  // shape, so the env var can be any reasonably long random string.
  if (secret) return deriveKey(secret);

  if (isProduction) {
    throw new Error("API_KEY_ENCRYPTION_SECRET is not configured");
  }

  // Development/test only. env.ts's own boot check already warns about a
  // missing secret at startup ("In der Entwicklung nur ein Hinweis"); this is
  // the functional half of that promise — without it, the warning was
  // survivable right up until someone actually opened Settings -> "Eigene
  // API-Keys" locally, where it turned into an unhandled throw. Every dev
  // process derives the SAME key from this fixed string, so a value encrypted
  // before a restart still decrypts after one.
  if (!warnedDevFallback) {
    warnedDevFallback = true;
    console.warn(
      "[crypto] API_KEY_ENCRYPTION_SECRET ist nicht gesetzt, nutze einen unsicheren " +
        "Dev-Fallback-Schluessel. In Produktion nicht moeglich: env.ts verweigert dort " +
        "den Start ohne einen echten Wert."
    );
  }
  return deriveKey(DEV_FALLBACK_SECRET);
}

/**
 * Encrypts `plaintext` into a single opaque base64 string (iv + auth tag +
 * ciphertext, packed together), the one value stored in `encrypted_key`.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

function decryptWith(key: Buffer, blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Reverses `encrypt`. Throws if the secret is wrong or the blob was tampered
 * with (GCM's auth tag check), callers should treat any throw as "this key
 * is unusable," not attempt to recover a partial value.
 *
 * During a rotation (API_KEY_ENCRYPTION_SECRET_PREVIOUS set) a blob the current
 * secret cannot open is tried against the previous one. GCM's auth tag makes
 * that safe: a wrong key never yields a wrong plaintext, it fails. If neither
 * opens the blob, the error from the CURRENT secret is the one thrown, so a
 * leftover PREVIOUS never changes what a genuinely broken row looks like.
 */
export function decrypt(blob: string): string {
  try {
    return decryptWith(getKey(), blob);
  } catch (error) {
    const previous = previousKey();
    if (!previous) throw error;
    try {
      return decryptWith(previous, blob);
    } catch {
      throw error;
    }
  }
}

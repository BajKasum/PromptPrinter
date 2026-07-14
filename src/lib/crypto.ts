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

function getKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error("API_KEY_ENCRYPTION_SECRET is not configured");
  // scrypt derives a proper 32-byte key regardless of the secret's own length/
  // shape, so the env var can be any reasonably long random string.
  return scryptSync(secret, SALT, 32);
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

/**
 * Reverses `encrypt`. Throws if the secret is wrong or the blob was tampered
 * with (GCM's auth tag check), callers should treat any throw as "this key
 * is unusable," not attempt to recover a partial value.
 */
export function decrypt(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

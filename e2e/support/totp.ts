import { createHmac } from "node:crypto";

// Der Code einer Authenticator-App (RFC 6238): HMAC-SHA1 über den 30-Sekunden-Zähler, sechs Ziffern. Von Hand, damit die Tests
// keine Abhängigkeit dafür brauchen und Supabase Auth wirklich einen fremd erzeugten Code prüft.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(secret: string): Buffer {
  let bits = "";
  for (const char of secret.toUpperCase().replace(/=+$/, "")) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error(`E2E: kein Base32-Zeichen im Schlüssel: ${char}`);
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)));
}

export function totpCode(secret: string, at: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  return String(hmac.readUInt32BE(offset) & 0x7fffffff).slice(-6).padStart(6, "0");
}

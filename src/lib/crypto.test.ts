import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("encrypt/decrypt", () => {
  const prevSecret = process.env.API_KEY_ENCRYPTION_SECRET;

  beforeEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = "test-secret-do-not-use-in-prod";
  });

  afterEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = prevSecret;
  });

  it("round-trips a plaintext value", () => {
    const key = "sk-ant-api03-abc123";
    expect(decrypt(encrypt(key))).toBe(key);
  });

  it("produces a different ciphertext each time (random iv)", () => {
    const key = "sk-ant-api03-abc123";
    expect(encrypt(key)).not.toBe(encrypt(key));
  });

  it("throws when the ciphertext has been tampered with", () => {
    const blob = encrypt("sk-ant-api03-abc123");
    const raw = Buffer.from(blob, "base64");
    raw[raw.length - 1] ^= 0xff; // flip the last byte
    const tampered = raw.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when decrypted with the wrong secret", () => {
    const blob = encrypt("sk-ant-api03-abc123");
    process.env.API_KEY_ENCRYPTION_SECRET = "a-different-secret";
    expect(() => decrypt(blob)).toThrow();
  });

  it("throws when the secret is missing", () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    expect(() => encrypt("sk-ant-api03-abc123")).toThrow(
      "API_KEY_ENCRYPTION_SECRET is not configured"
    );
  });
});

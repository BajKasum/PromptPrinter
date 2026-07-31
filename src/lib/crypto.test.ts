import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});

// isProduction is a module-level singleton resolved from process.env at
// import time (same convention as rate-limit.ts), so exercising both
// configurations needs a fresh module instance per test (vi.resetModules() +
// a dynamic re-import) rather than the statically-imported encrypt/decrypt
// above, which always run under whatever NODE_ENV the test process itself
// started under (vitest's own default, "test").
describe("getKey, missing-secret behavior differs by environment", () => {
  const prevSecret = process.env.API_KEY_ENCRYPTION_SECRET;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
    else process.env.API_KEY_ENCRYPTION_SECRET = prevSecret;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("still throws in production when the secret is missing — unchanged from before", async () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { encrypt: prodEncrypt } = await import("@/lib/crypto");

    expect(() => prodEncrypt("sk-ant-api03-abc123")).toThrow(
      "API_KEY_ENCRYPTION_SECRET is not configured"
    );
  });

  it("falls back to a fixed dev-only key outside production instead of throwing", async () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { encrypt: devEncrypt, decrypt: devDecrypt } = await import("@/lib/crypto");

    const key = "sk-ant-api03-abc123";
    expect(() => devEncrypt(key)).not.toThrow();
    expect(devDecrypt(devEncrypt(key))).toBe(key);
  });

  it("derives the same dev fallback key across separate module instances", async () => {
    // The point of a FIXED fallback rather than a per-boot random one: a value
    // encrypted before a dev-server restart must still decrypt after one.
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const first = await import("@/lib/crypto");
    const blob = first.encrypt("sk-ant-api03-abc123");

    vi.resetModules();
    const second = await import("@/lib/crypto");
    expect(second.decrypt(blob)).toBe("sk-ant-api03-abc123");
  });

  it("prefers a real secret over the dev fallback whenever one is set, even outside production", async () => {
    process.env.API_KEY_ENCRYPTION_SECRET = "a-real-local-secret";
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const withRealSecret = await import("@/lib/crypto");
    const blob = withRealSecret.encrypt("sk-ant-api03-abc123");

    // A value encrypted under the REAL secret must not be readable by a
    // process that only has the dev fallback — the fallback is a convenience
    // for an unconfigured machine, not a bypass for a configured one.
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    vi.resetModules();
    const withFallbackOnly = await import("@/lib/crypto");
    expect(() => withFallbackOnly.decrypt(blob)).toThrow();
  });
});

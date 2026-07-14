import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimitKey } from "@/lib/rate-limit";

function req(headers: Record<string, string> = {}) {
  return new Request("https://promptprinter.app/api/chat", { headers });
}

describe("rateLimitKey", () => {
  it("keys by user id when present, ignoring headers", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "1.2.3.4" }), "user-123")).toBe(
      "u:user-123"
    );
  });

  it("falls back to the ip when userId is null", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "1.2.3.4" }), null)).toBe("ip:1.2.3.4");
  });

  it("takes the first x-forwarded-for entry and trims it", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "  9.9.9.9 , 8.8.8.8 " }))).toBe(
      "ip:9.9.9.9"
    );
  });

  it("uses cf-connecting-ip when there is no x-forwarded-for", () => {
    expect(rateLimitKey(req({ "cf-connecting-ip": "5.5.5.5" }))).toBe("ip:5.5.5.5");
  });

  it('falls back to "unknown" without any ip headers', () => {
    expect(rateLimitKey(req())).toBe("ip:unknown");
  });
});

// redis/isProduction are module-level singletons resolved from process.env at
// import time, so exercising both configurations needs a fresh module
// instance per test (vi.resetModules() + a dynamic re-import) rather than
// the statically-imported rateLimitKey above.
describe("rateLimit, Upstash-missing behavior differs by environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails closed in production when Upstash isn't configured, instead of a per-instance fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { rateLimit } = await import("@/lib/rate-limit");

    const result = await rateLimit("ip:1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("still uses the in-memory limiter outside production when Upstash isn't configured", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { rateLimit } = await import("@/lib/rate-limit");

    const result = await rateLimit("ip:dev-check", { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

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

  // The security-relevant one. x-forwarded-for is a chain and every proxy
  // APPENDS what it saw, so the caller's own value lands FIRST and the edge's
  // observation lands LAST. Reading [0] — which this code did, and which an
  // earlier version of this very test asserted as the correct behavior — let
  // any caller mint unlimited fresh rate-limit buckets by varying a header,
  // so the limit was effectively absent for unauthenticated requests.
  it("ignores a caller-prepended x-forwarded-for entry and uses the last one", () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "  9.9.9.9 , 8.8.8.8 " }))).toBe(
      "ip:8.8.8.8"
    );
  });

  it("ignores a forged chain however many entries the caller prepends", () => {
    expect(
      rateLimitKey(req({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3, 8.8.8.8" }))
    ).toBe("ip:8.8.8.8");
  });

  it("prefers cf-connecting-ip over the x-forwarded-for chain", () => {
    expect(
      rateLimitKey(
        req({ "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": "9.9.9.9, 1.1.1.1" })
      )
    ).toBe("ip:5.5.5.5");
  });

  it("prefers x-real-ip over the x-forwarded-for chain", () => {
    expect(
      rateLimitKey(req({ "x-real-ip": "6.6.6.6", "x-forwarded-for": "9.9.9.9, 1.1.1.1" }))
    ).toBe("ip:6.6.6.6");
  });

  it("uses cf-connecting-ip when there is no x-forwarded-for", () => {
    expect(rateLimitKey(req({ "cf-connecting-ip": "5.5.5.5" }))).toBe("ip:5.5.5.5");
  });

  it('falls back to "unknown" without any ip headers', () => {
    expect(rateLimitKey(req())).toBe("ip:unknown");
  });

  it('falls back to "unknown" rather than an empty bucket on a blank header', () => {
    expect(rateLimitKey(req({ "x-forwarded-for": "   " }))).toBe("ip:unknown");
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

// reserveMonthlyQuota is the atomic (Redis INCR) close for /api/chat's
// check-then-act monthly-quota race; same fresh-module-per-test pattern as
// above since it reads the module-level `redis` singleton at import time.
describe("reserveMonthlyQuota", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@upstash/redis");
    vi.resetModules();
  });

  it("returns null when Redis isn't configured, so callers fall back to their own check", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { reserveMonthlyQuota } = await import("@/lib/rate-limit");

    expect(await reserveMonthlyQuota("chat-quota:u1:2026-07", 200)).toBeNull();
  });

  it("allows a request under the limit, release() decrements the counter back", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const incr = vi.fn().mockResolvedValue(5);
    const decr = vi.fn().mockResolvedValue(4);
    const expire = vi.fn().mockResolvedValue(1);
    vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => ({ incr, decr, expire }) } }));
    vi.resetModules();
    const { reserveMonthlyQuota } = await import("@/lib/rate-limit");

    const reservation = await reserveMonthlyQuota("chat-quota:u1:2026-07", 200);
    expect(reservation?.allowed).toBe(true);
    expect(expire).not.toHaveBeenCalled(); // not the first hit this month (count=5)

    await reservation?.release();
    expect(decr).toHaveBeenCalledWith("chat-quota:u1:2026-07");
  });

  it("sets a cleanup expiry only on the first reservation for a month-key", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const incr = vi.fn().mockResolvedValue(1);
    const expire = vi.fn().mockResolvedValue(1);
    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => ({ incr, expire, decr: vi.fn() }) },
    }));
    vi.resetModules();
    const { reserveMonthlyQuota } = await import("@/lib/rate-limit");

    await reserveMonthlyQuota("chat-quota:u1:2026-07", 200);
    expect(expire).toHaveBeenCalledWith("chat-quota:u1:2026-07", 45 * 24 * 60 * 60);
  });

  it("rejects once the reserved count exceeds the limit", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const incr = vi.fn().mockResolvedValue(201);
    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => ({ incr, expire: vi.fn(), decr: vi.fn() }) },
    }));
    vi.resetModules();
    const { reserveMonthlyQuota } = await import("@/lib/rate-limit");

    const reservation = await reserveMonthlyQuota("chat-quota:u1:2026-07", 200);
    expect(reservation?.allowed).toBe(false);
  });

  it("fails open (returns null) instead of throwing when Redis errors", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => ({ incr: vi.fn().mockRejectedValue(new Error("down")) }) },
    }));
    vi.resetModules();
    const { reserveMonthlyQuota } = await import("@/lib/rate-limit");

    expect(await reserveMonthlyQuota("chat-quota:u1:2026-07", 200)).toBeNull();
  });
});

// reserveServerKeyCall is the global circuit breaker from QA finding S-1,
// step 4: a ceiling on the operator's own provider key per UTC day, whoever
// runs it up. Same fresh-module-per-test pattern as above.
describe("reserveServerKeyCall", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@upstash/redis");
    vi.resetModules();
  });

  async function withRedis(incr: ReturnType<typeof vi.fn>, decr = vi.fn(), expire = vi.fn()) {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => ({ incr, decr, expire }) } }));
    vi.resetModules();
    return await import("@/lib/rate-limit");
  }

  it("returns null without Redis, so the guard never blocks chat on its own absence", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { reserveServerKeyCall } = await import("@/lib/rate-limit");

    expect(await reserveServerKeyCall()).toBeNull();
  });

  it("allows a call well under the default budget", async () => {
    const { reserveServerKeyCall } = await withRedis(vi.fn().mockResolvedValue(12));
    expect((await reserveServerKeyCall())?.allowed).toBe(true);
  });

  it("refuses once the default daily budget is exceeded", async () => {
    const { reserveServerKeyCall } = await withRedis(vi.fn().mockResolvedValue(1001));
    expect((await reserveServerKeyCall())?.allowed).toBe(false);
  });

  it("honours LLM_DAILY_CALL_BUDGET over the default", async () => {
    vi.stubEnv("LLM_DAILY_CALL_BUDGET", "5");
    const { reserveServerKeyCall } = await withRedis(vi.fn().mockResolvedValue(6));
    expect((await reserveServerKeyCall())?.allowed).toBe(false);
  });

  it("ignores a nonsense budget value and falls back to the default", async () => {
    vi.stubEnv("LLM_DAILY_CALL_BUDGET", "keine-zahl");
    const { reserveServerKeyCall } = await withRedis(vi.fn().mockResolvedValue(999));
    expect((await reserveServerKeyCall())?.allowed).toBe(true);
  });

  it("keys by UTC day and sets a cleanup expiry on the first call of that day", async () => {
    const incr = vi.fn().mockResolvedValue(1);
    const expire = vi.fn().mockResolvedValue(1);
    const { reserveServerKeyCall } = await withRedis(incr, vi.fn(), expire);

    await reserveServerKeyCall();

    const day = new Date().toISOString().slice(0, 10);
    expect(incr).toHaveBeenCalledWith(`llm-daily-calls:${day}`);
    expect(expire).toHaveBeenCalledWith(`llm-daily-calls:${day}`, 2 * 24 * 60 * 60);
  });

  it("release() gives the slot back, so a failed turn costs no budget", async () => {
    const decr = vi.fn().mockResolvedValue(11);
    const { reserveServerKeyCall } = await withRedis(vi.fn().mockResolvedValue(12), decr);

    await (await reserveServerKeyCall())?.release();

    const day = new Date().toISOString().slice(0, 10);
    expect(decr).toHaveBeenCalledWith(`llm-daily-calls:${day}`);
  });

  it("fails open when Redis errors, matching reserveMonthlyQuota", async () => {
    const { reserveServerKeyCall } = await withRedis(
      vi.fn().mockRejectedValue(new Error("down"))
    );
    expect(await reserveServerKeyCall()).toBeNull();
  });
});

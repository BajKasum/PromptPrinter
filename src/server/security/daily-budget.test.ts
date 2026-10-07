import { afterEach, describe, expect, it, vi } from "vitest";

// Das Tagesbudget und der Upstash-Client liegen seit der Zerlegung von rate-limit.ts (Betriebs-Audit,
// Folgesitzung 2026-10-07, Dateigröße) in daily-budget.ts und redis-client.ts. Die Kanten prüft
// rate-limit.budget.test.ts über rate-limit.ts; hier steht, dass rate-limit.ts denselben Satz weiterreicht
// (keine zweite Kopie, kein zweiter Client) und dass die Dateien auch allein tragen.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

describe("redis-client.ts", () => {
  it("ist null, solange nicht beide Werte gesetzt sind", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { redis } = await import("@/server/security/redis-client");
    expect(redis).toBeNull();
  });

  it("ist der Client aus Redis.fromEnv(), wenn beide Werte gesetzt sind", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const client = { marker: "client" };
    vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => client } }));
    vi.resetModules();
    const { redis } = await import("@/server/security/redis-client");
    expect(redis).toBe(client);
  });
});

describe("daily-budget.ts", () => {
  it("rate-limit.ts reicht dieselben drei Funktionen weiter", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const viaRateLimit = await import("@/server/security/rate-limit");
    const own = await import("@/server/security/daily-budget");
    expect(viaRateLimit.readDailyServerKeyUsage).toBe(own.readDailyServerKeyUsage);
    expect(viaRateLimit.reserveFailoverCall).toBe(own.reserveFailoverCall);
    expect(viaRateLimit.reserveServerKeyCall).toBe(own.reserveServerKeyCall);
  });

  it("trägt auch allein: ohne Redis liefern alle drei null", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { readDailyServerKeyUsage, reserveFailoverCall, reserveServerKeyCall } = await import(
      "@/server/security/daily-budget"
    );
    expect(await readDailyServerKeyUsage()).toBeNull();
    expect(await reserveFailoverCall()).toBeNull();
    expect(await reserveServerKeyCall()).toBeNull();
  });
});

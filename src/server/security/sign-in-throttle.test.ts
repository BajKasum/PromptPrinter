import { afterEach, describe, expect, it, vi } from "vitest";
import { counterRedisDouble } from "./redis-double";

async function withCounter(start = 0) {
  let count = start;
  const incr = vi.fn(async () => ++count);
  const expire = vi.fn(async () => 1);
  const decr = vi.fn(async () => (count = Math.max(0, count - 1)));
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  const double = counterRedisDouble({ incr, expire, decr });
  vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => double } }));
  vi.resetModules();
  return { ...(await import("./sign-in-throttle")), incr, expire, count: () => count };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

describe("sign-in-throttle", () => {
  it("sperrt nach zehn Fehlversuchen, nicht davor", async () => {
    const { reserveSignInAttempt } = await withCounter();
    for (let i = 0; i < 10; i++) {
      const attempt = await reserveSignInAttempt("du@example.com");
      expect(attempt.throttled, `Versuch ${i + 1}`).toBe(false);
      await attempt.settle(true);
    }
    expect((await reserveSignInAttempt("du@example.com")).throttled).toBe(true);
  });

  it("reserviert vor dem Aufruf: gleichzeitige Versuche kommen nicht alle an der Sperre vorbei", async () => {
    const { reserveSignInAttempt } = await withCounter();
    const attempts = await Promise.all(Array.from({ length: 15 }, () => reserveSignInAttempt("du@example.com")));
    expect(attempts.filter((a) => !a.throttled)).toHaveLength(10);
  });

  it("ein Versuch ohne falsche Zugangsdaten gibt seinen Platz zurück, ein gesperrter zählt nicht", async () => {
    const { reserveSignInAttempt, count } = await withCounter();
    const ok = await reserveSignInAttempt("du@example.com");
    await ok.settle(false);
    expect(count()).toBe(0);
    for (let i = 0; i < 10; i++) await (await reserveSignInAttempt("du@example.com")).settle(true);
    await reserveSignInAttempt("du@example.com");
    expect(count()).toBe(10);
  });

  it("zählt Schreibweisen derselben Adresse zusammen und legt sie nur gehasht ab", async () => {
    const { reserveSignInAttempt, incr } = await withCounter();
    await reserveSignInAttempt(" Du@Example.com ");
    await reserveSignInAttempt("du@example.com");
    const [first, second] = incr.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(first).toBe(second);
    expect(first).not.toContain("example");
  });

  it("gibt dem Zähler ein Fenster von 15 Minuten", async () => {
    const { reserveSignInAttempt, expire } = await withCounter();
    await reserveSignInAttempt("du@example.com");
    expect(expire.mock.calls[0]).toEqual([expect.any(String), 900, "NX"]);
  });

  it("ist ohne Redis offen", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { reserveSignInAttempt } = await import("./sign-in-throttle");
    const attempt = await reserveSignInAttempt("du@example.com");
    await attempt.settle(true);
    expect((await reserveSignInAttempt("du@example.com")).throttled).toBe(false);
  });

  it("ist bei einem Redis-Fehler offen", async () => {
    const { reserveSignInAttempt, incr } = await withCounter();
    incr.mockRejectedValue(new Error("down"));
    expect((await reserveSignInAttempt("du@example.com")).throttled).toBe(false);
  });
});

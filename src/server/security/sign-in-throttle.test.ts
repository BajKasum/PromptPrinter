import { afterEach, describe, expect, it, vi } from "vitest";
import { counterRedisDouble } from "./redis-double";

async function withCounter(start = 0) {
  let count = start;
  const incr = vi.fn(async () => ++count);
  const expire = vi.fn(async () => 1);
  const get = vi.fn(async () => (count === 0 ? null : count));
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.doMock("@upstash/redis", () => ({
    Redis: { fromEnv: () => ({ ...counterRedisDouble({ incr, expire }), get }) },
  }));
  vi.resetModules();
  return { ...(await import("./sign-in-throttle")), incr, expire, get };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

describe("sign-in-throttle", () => {
  it("sperrt ab dem zehnten Fehlversuch, nicht davor", async () => {
    const { isSignInThrottled, recordFailedSignIn } = await withCounter();
    for (let i = 0; i < 9; i++) await recordFailedSignIn("du@example.com");
    expect(await isSignInThrottled("du@example.com")).toBe(false);
    await recordFailedSignIn("du@example.com");
    expect(await isSignInThrottled("du@example.com")).toBe(true);
  });

  it("zählt Schreibweisen derselben Adresse zusammen und legt sie nur gehasht ab", async () => {
    const { recordFailedSignIn, incr } = await withCounter();
    await recordFailedSignIn(" Du@Example.com ");
    await recordFailedSignIn("du@example.com");
    const [first, second] = incr.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(first).toBe(second);
    expect(first).not.toContain("example");
  });

  it("gibt dem Zähler ein Fenster von 15 Minuten", async () => {
    const { recordFailedSignIn, expire } = await withCounter();
    await recordFailedSignIn("du@example.com");
    expect(expire.mock.calls[0]).toEqual([expect.any(String), 900, "NX"]);
  });

  it("ist ohne Redis offen", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { isSignInThrottled, recordFailedSignIn } = await import("./sign-in-throttle");
    await recordFailedSignIn("du@example.com");
    expect(await isSignInThrottled("du@example.com")).toBe(false);
  });

  it("ist bei einem Redis-Fehler offen", async () => {
    const { isSignInThrottled, get } = await withCounter();
    get.mockRejectedValue(new Error("down"));
    expect(await isSignInThrottled("du@example.com")).toBe(false);
  });
});

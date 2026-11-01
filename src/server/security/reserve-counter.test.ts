import { afterEach, describe, expect, it, vi } from "vitest";
import { counterRedisDouble } from "./redis-double";

async function withRedis(redis: unknown) {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => redis } }));
  vi.resetModules();
  return (await import("./reserve-counter")).reserveCounter;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

describe("reserveCounter", () => {
  it("liefert null ohne Redis", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { reserveCounter } = await import("./reserve-counter");
    expect(await reserveCounter({ key: "k", limit: 1, ttlSeconds: 60 })).toBeNull();
  });

  it("zählt und setzt den Ablauf in einer Transaktion, nie als zwei Einzelbefehle", async () => {
    const incr = vi.fn().mockResolvedValue(1);
    const expire = vi.fn().mockResolvedValue(1);
    const direct = { incr: vi.fn(), expire: vi.fn() };
    const multi = counterRedisDouble({ incr, expire }).multi;
    const reserveCounter = await withRedis({ ...direct, multi });

    await reserveCounter({ key: "k", limit: 5, ttlSeconds: 60 });

    expect(incr).toHaveBeenCalledWith("k");
    expect(expire).toHaveBeenCalledWith("k", 60, "NX");
    expect(direct.incr).not.toHaveBeenCalled();
    expect(direct.expire).not.toHaveBeenCalled();
  });

  it("scheitert die Transaktion, ist kein Platz verbraucht und die Antwort null", async () => {
    const reserveCounter = await withRedis({
      multi: () => {
        const chain = { incr: () => chain, expire: () => chain, exec: () => Promise.reject(new Error("down")) };
        return chain;
      },
    });
    expect(await reserveCounter({ key: "k", limit: 5, ttlSeconds: 60 })).toBeNull();
  });

  it("erlaubt genau bis zur Grenze und meldet jede Überschreitung mit dem Stand", async () => {
    const onExhausted = vi.fn();
    const incr = vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(6);
    const reserveCounter = await withRedis(counterRedisDouble({ incr, expire: vi.fn() }));

    expect((await reserveCounter({ key: "k", limit: 5, ttlSeconds: 60, onExhausted }))?.allowed).toBe(true);
    expect(onExhausted).not.toHaveBeenCalled();
    expect((await reserveCounter({ key: "k", limit: 5, ttlSeconds: 60, onExhausted }))?.allowed).toBe(false);
    expect(onExhausted).toHaveBeenCalledWith(6);
  });

  it("gibt über ein Skript zurück, das einen abgelaufenen Schlüssel nicht neu anlegt", async () => {
    const evalScript = vi.fn().mockResolvedValue(0);
    const { multi } = counterRedisDouble({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn() });
    const reserveCounter = await withRedis({ multi, eval: evalScript });

    const reservation = await reserveCounter({ key: "k", limit: 5, ttlSeconds: 60 });
    await reservation?.release();

    expect(evalScript.mock.calls[0][0]).toContain("EXISTS");
    expect(evalScript.mock.calls[0][1]).toEqual(["k"]);
  });

  it("schluckt einen Fehler beim Zurückgeben", async () => {
    const { multi } = counterRedisDouble({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn() });
    const reserveCounter = await withRedis({ multi, eval: vi.fn().mockRejectedValue(new Error("down")) });
    const reservation = await reserveCounter({ key: "k", limit: 5, ttlSeconds: 60 });
    await expect(reservation?.release()).resolves.toBeUndefined();
  });
});

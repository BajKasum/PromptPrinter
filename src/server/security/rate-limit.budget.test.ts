import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Tagesbudgets des Servers (Serverschlüssel und Ausweich-Anbieter): Kanten, die rate-limit.test.ts nicht
// festhält. Festgenagelt vor der Zerlegung von rate-limit.ts (Betriebs-Audit, Folgesitzung 2026-10-07,
// Dateigröße), über dieselbe Fläche ("@/server/security/rate-limit"). Nach dem Schnitt bleiben sie unverändert.

const { logWarning } = vi.hoisted(() => ({ logWarning: vi.fn() }));
vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()),
  logWarning,
}));

type RedisDouble = {
  incr?: ReturnType<typeof vi.fn>;
  decr?: ReturnType<typeof vi.fn>;
  expire?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
};

async function withRedis(redis: RedisDouble) {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => redis } }));
  vi.resetModules();
  return await import("@/server/security/rate-limit");
}

async function withoutRedis() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.resetModules();
  return await import("@/server/security/rate-limit");
}

beforeEach(() => {
  logWarning.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.doUnmock("@upstash/redis");
  vi.resetModules();
});

const DAY = "2026-10-07";
const TWO_DAYS = 2 * 24 * 60 * 60;

describe("readDailyServerKeyUsage", () => {
  it("liefert null ohne Redis", async () => {
    const { readDailyServerKeyUsage } = await withoutRedis();
    expect(await readDailyServerKeyUsage()).toBeNull();
  });

  it("liest den Zähler des heutigen UTC-Tages und das Budget, ohne etwas zu verbrauchen", async () => {
    const get = vi.fn().mockResolvedValue(37);
    const redis = { get, incr: vi.fn(), decr: vi.fn(), expire: vi.fn() };
    const { readDailyServerKeyUsage } = await withRedis(redis);

    expect(await readDailyServerKeyUsage()).toEqual({ used: 37, budget: 1000 });
    expect(get).toHaveBeenCalledWith(`llm-daily-calls:${DAY}`);
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.decr).not.toHaveBeenCalled();
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it("zählt einen fehlenden Schlüssel (heute noch kein Aufruf) als 0", async () => {
    const { readDailyServerKeyUsage } = await withRedis({ get: vi.fn().mockResolvedValue(null) });
    expect(await readDailyServerKeyUsage()).toEqual({ used: 0, budget: 1000 });
  });

  it("nimmt LLM_DAILY_CALL_BUDGET als Budget, und bei leer, Leerzeichen, Unsinn, 0 oder negativ den Standard 1000", async () => {
    vi.stubEnv("LLM_DAILY_CALL_BUDGET", "250");
    const set = await withRedis({ get: vi.fn().mockResolvedValue(1) });
    expect((await set.readDailyServerKeyUsage())?.budget).toBe(250);

    for (const bad of ["", "   ", "keine-zahl", "0", "-5"]) {
      vi.stubEnv("LLM_DAILY_CALL_BUDGET", bad);
      const { readDailyServerKeyUsage } = await withRedis({ get: vi.fn().mockResolvedValue(1) });
      expect((await readDailyServerKeyUsage())?.budget, JSON.stringify(bad)).toBe(1000);
    }
  });

  it("liefert null statt zu werfen, wenn Redis nicht antwortet", async () => {
    const { readDailyServerKeyUsage } = await withRedis({ get: vi.fn().mockRejectedValue(new Error("down")) });
    expect(await readDailyServerKeyUsage()).toBeNull();
  });

  it("wechselt mit dem UTC-Tag, nicht mit dem Tag der Ortszeit", async () => {
    vi.setSystemTime(new Date("2026-10-07T23:30:00Z"));
    const get = vi.fn().mockResolvedValue(0);
    const { readDailyServerKeyUsage } = await withRedis({ get });
    await readDailyServerKeyUsage();
    expect(get).toHaveBeenLastCalledWith("llm-daily-calls:2026-10-07");

    vi.setSystemTime(new Date("2026-10-08T00:30:00Z"));
    await readDailyServerKeyUsage();
    expect(get).toHaveBeenLastCalledWith("llm-daily-calls:2026-10-08");
  });
});

describe("reserveServerKeyCall: Grenze, Warnsignal, Aufräumen", () => {
  it("erlaubt den Aufruf genau am Budget (1000) und sperrt den nächsten (1001)", async () => {
    const at = await withRedis({ incr: vi.fn().mockResolvedValue(1000), expire: vi.fn(), decr: vi.fn() });
    expect((await at.reserveServerKeyCall())?.allowed).toBe(true);
    const over = await withRedis({ incr: vi.fn().mockResolvedValue(1001), expire: vi.fn(), decr: vi.fn() });
    expect((await over.reserveServerKeyCall())?.allowed).toBe(false);
  });

  it("warnt bei Überschreitung einmal je Prozess, mit Tag, Stand, Budget und Hinweis, und nicht davor", async () => {
    vi.stubEnv("LLM_DAILY_CALL_BUDGET", "5");
    const incr = vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(6).mockResolvedValueOnce(7);
    const { reserveServerKeyCall } = await withRedis({ incr, expire: vi.fn(), decr: vi.fn() });

    await reserveServerKeyCall(); // genau am Budget
    expect(logWarning).not.toHaveBeenCalled();

    await reserveServerKeyCall(); // erste Überschreitung
    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith("spend_guard.budget_exhausted", {
      day: DAY,
      used: 6,
      budget: 5,
      note: expect.stringContaining("LLM_DAILY_CALL_BUDGET"),
    });

    await reserveServerKeyCall(); // weitere Überschreitung: keine zweite Warnung
    expect(logWarning).toHaveBeenCalledTimes(1);
  });

  it("setzt das Ablaufdatum nur beim ersten Aufruf des Tages (Stand 1), nicht bei jedem weiteren", async () => {
    const expire = vi.fn().mockResolvedValue(1);
    const first = await withRedis({ incr: vi.fn().mockResolvedValue(1), expire, decr: vi.fn() });
    await first.reserveServerKeyCall();
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith(`llm-daily-calls:${DAY}`, TWO_DAYS);

    const later = await withRedis({ incr: vi.fn().mockResolvedValue(2), expire, decr: vi.fn() });
    await later.reserveServerKeyCall();
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it("gibt den Platz über release() zurück und schluckt einen Fehler dabei", async () => {
    const decr = vi.fn().mockRejectedValue(new Error("down"));
    const { reserveServerKeyCall } = await withRedis({ incr: vi.fn().mockResolvedValue(3), expire: vi.fn(), decr });
    const reservation = await reserveServerKeyCall();
    await expect(reservation?.release()).resolves.toBeUndefined();
    expect(decr).toHaveBeenCalledWith(`llm-daily-calls:${DAY}`);
  });

  it("zählt je UTC-Tag: kurz vor und kurz nach Mitternacht UTC liegen auf verschiedenen Schlüsseln", async () => {
    const incr = vi.fn().mockResolvedValue(2);
    const { reserveServerKeyCall } = await withRedis({ incr, expire: vi.fn(), decr: vi.fn() });

    vi.setSystemTime(new Date("2026-10-07T23:59:59Z"));
    await reserveServerKeyCall();
    expect(incr).toHaveBeenLastCalledWith("llm-daily-calls:2026-10-07");

    vi.setSystemTime(new Date("2026-10-08T00:00:01Z"));
    await reserveServerKeyCall();
    expect(incr).toHaveBeenLastCalledWith("llm-daily-calls:2026-10-08");
  });
});

describe("Redis gilt nur, wenn URL und Token beide gesetzt sind", () => {
  it("URL ohne Token und Token ohne URL heißen: kein Redis, alle drei Tagesbudget-Funktionen liefern null", async () => {
    for (const [url, token] of [
      ["https://example.upstash.io", ""],
      ["", "token"],
    ]) {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", url);
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", token);
      vi.doMock("@upstash/redis", () => ({
        Redis: {
          fromEnv: () => ({
            incr: vi.fn().mockResolvedValue(1),
            expire: vi.fn(),
            decr: vi.fn(),
            get: vi.fn().mockResolvedValue(1),
          }),
        },
      }));
      vi.resetModules();
      const m = await import("@/server/security/rate-limit");
      expect(await m.reserveServerKeyCall(), JSON.stringify([url, token])).toBeNull();
      expect(await m.reserveFailoverCall(), JSON.stringify([url, token])).toBeNull();
      expect(await m.readDailyServerKeyUsage(), JSON.stringify([url, token])).toBeNull();
    }
  });
});

describe("reserveFailoverCall: Schlüssel, Aufräumen, Rückgabe, Warnsignal", () => {
  it("liefert null ohne Redis, damit ein Zug auf dem Ausweich-Anbieter nicht an der Abwesenheit scheitert", async () => {
    const { reserveFailoverCall } = await withoutRedis();
    expect(await reserveFailoverCall()).toBeNull();
  });

  it("liefert null statt zu werfen, wenn Redis beim Zählen ausfällt", async () => {
    const { reserveFailoverCall } = await withRedis({ incr: vi.fn().mockRejectedValue(new Error("down")) });
    expect(await reserveFailoverCall()).toBeNull();
  });

  it("zählt auf einem eigenen Schlüssel je UTC-Tag, getrennt vom Budget des Serverschlüssels", async () => {
    const incr = vi.fn().mockResolvedValue(2);
    const { reserveFailoverCall, reserveServerKeyCall } = await withRedis({
      incr,
      expire: vi.fn(),
      decr: vi.fn(),
    });

    await reserveFailoverCall();
    expect(incr).toHaveBeenLastCalledWith(`llm-failover-calls:${DAY}`);
    await reserveServerKeyCall();
    expect(incr).toHaveBeenLastCalledWith(`llm-daily-calls:${DAY}`);

    vi.setSystemTime(new Date("2026-10-08T00:00:01Z"));
    await reserveFailoverCall();
    expect(incr).toHaveBeenLastCalledWith("llm-failover-calls:2026-10-08");
  });

  it("setzt das Ablaufdatum nur beim ersten Zug des Tages", async () => {
    const expire = vi.fn().mockResolvedValue(1);
    const first = await withRedis({ incr: vi.fn().mockResolvedValue(1), expire, decr: vi.fn() });
    await first.reserveFailoverCall();
    expect(expire).toHaveBeenCalledWith(`llm-failover-calls:${DAY}`, TWO_DAYS);

    expire.mockClear();
    const later = await withRedis({ incr: vi.fn().mockResolvedValue(2), expire, decr: vi.fn() });
    await later.reserveFailoverCall();
    expect(expire).not.toHaveBeenCalled();
  });

  it("gibt den Platz über release() zurück und schluckt einen Fehler dabei", async () => {
    const decr = vi.fn().mockRejectedValue(new Error("down"));
    const { reserveFailoverCall } = await withRedis({ incr: vi.fn().mockResolvedValue(3), expire: vi.fn(), decr });
    const reservation = await reserveFailoverCall();
    await expect(reservation?.release()).resolves.toBeUndefined();
    expect(decr).toHaveBeenCalledWith(`llm-failover-calls:${DAY}`);
  });

  it("warnt bei Überschreitung einmal je Prozess, mit Tag, Stand, Budget und Hinweis, und nicht davor", async () => {
    vi.stubEnv("LLM_FAILOVER_DAILY_CALLS", "3");
    const incr = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const { reserveFailoverCall } = await withRedis({ incr, expire: vi.fn(), decr: vi.fn() });

    expect((await reserveFailoverCall())?.allowed).toBe(true); // genau am Budget
    expect(logWarning).not.toHaveBeenCalled();

    expect((await reserveFailoverCall())?.allowed).toBe(false);
    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith("spend_guard.failover_budget_exhausted", {
      day: DAY,
      used: 4,
      budget: 3,
      note: expect.stringContaining("LLM_FAILOVER_DAILY_CALLS"),
    });

    await reserveFailoverCall();
    expect(logWarning).toHaveBeenCalledTimes(1);
  });

  it("die beiden Warnsignale sind unabhängig: das eine verbraucht das andere nicht", async () => {
    vi.stubEnv("LLM_DAILY_CALL_BUDGET", "1");
    vi.stubEnv("LLM_FAILOVER_DAILY_CALLS", "1");
    const { reserveServerKeyCall, reserveFailoverCall } = await withRedis({
      incr: vi.fn().mockResolvedValue(2),
      expire: vi.fn(),
      decr: vi.fn(),
    });

    await reserveServerKeyCall();
    await reserveFailoverCall();

    expect(logWarning.mock.calls.map((c) => c[0])).toEqual([
      "spend_guard.budget_exhausted",
      "spend_guard.failover_budget_exhausted",
    ]);
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { counterRedisDouble } from "@/server/security/redis-double";
import { FREE_TRIAL } from "@/shared/lib/plans";

vi.mock("@/shared/lib/observability", () => ({ logWarning: vi.fn() }));

type FreeTrial = typeof import("@/server/free-trial");

// free-trial.ts zählt ohne Redis in einer Map (Tests, Entwicklung) und in Produktion in Redis. Dieselben Fälle laufen
// deshalb gegen beide Wege: die Map und eine Attrappe, die Redis nachbildet, so weit free-trial.ts und
// reserve-counter.ts es nutzen. Was nur Redis betrifft (Ablaufzeiten, Fehler je Befehl), steht im letzten Block.

const ACCOUNT_TTL = 400 * 24 * 60 * 60;
const DAY_TTL = 2 * 24 * 60 * 60;
const DAY = "2026-11-26";

const req = (ip = "192.0.2.1") => new Request("https://promptprinter.app/api/chat", { headers: { "x-forwarded-for": ip } });

/** Lädt free-trial.ts neu, mit diesem Client; `null` heißt kein Redis, dann zählt die Map. */
async function load(redis: unknown): Promise<FreeTrial> {
  vi.resetModules();
  vi.doMock("@/server/security/redis-client", () => ({ redis }));
  return import("@/server/free-trial");
}

/**
 * Redis im Speicher: Zähler, Mengen und Ablaufzeiten, `NX` lässt einen gesetzten Ablauf stehen, `decr` zieht wie das
 * Rückgabe-Skript nur ab, was noch da ist. Jeder Befehl ist eine Attrappe, die ein Test scheitern lassen kann.
 */
function fakeRedis() {
  const counters = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  const expiry = new Map<string, number>();
  const commands = {
    get: vi.fn(async (key: string): Promise<unknown> => counters.get(key) ?? null),
    incr: vi.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
    decr: vi.fn(async (key: string) => {
      const current = counters.get(key);
      if (current === undefined) return 0;
      counters.set(key, current - 1);
      return current - 1;
    }),
    expire: vi.fn(async (key: string, seconds: number, mode?: string) => {
      if (mode === "NX" && expiry.has(key)) return 0;
      expiry.set(key, seconds);
      return 1;
    }),
    sadd: vi.fn(async (key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>();
      const added = set.has(member) ? 0 : 1;
      sets.set(key, set.add(member));
      return added;
    }),
    sismember: vi.fn(async (key: string, member: string) => (sets.get(key)?.has(member) ? 1 : 0)),
  };
  return {
    client: counterRedisDouble(commands),
    commands,
    counters,
    expiry,
    markDelivered(userId: string, hash: string) {
      const key = `free-trial:delivered:${userId}`;
      sets.set(key, (sets.get(key) ?? new Set<string>()).add(hash));
    },
    reset() {
      counters.clear();
      sets.clear();
      expiry.clear();
      for (const command of Object.values(commands)) command.mockClear();
    },
  };
}

type Backend = { ft: FreeTrial; markDelivered: (userId: string, hash: string) => void; reset: () => void };

const backends: { name: string; open: () => Promise<Backend> }[] = [
  {
    name: "ohne Redis (Map)",
    async open() {
      const ft = await load(null);
      return { ft, markDelivered: ft.__markDeliveredForTests, reset: ft.__resetFreeTrialMemoryForTests };
    },
  },
  {
    name: "über Redis (Attrappe)",
    async open() {
      const fake = fakeRedis();
      const ft = await load(fake.client);
      return { ft, markDelivered: fake.markDelivered, reset: fake.reset };
    },
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DAY}T12:00:00Z`));
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("FREE_TRIAL_DAILY_CALLS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe.each(backends)("Gratis-Rahmen $name", ({ open }) => {
  let backend: Backend;
  beforeAll(async () => {
    backend = await open();
  });
  beforeEach(() => backend.reset());

  async function turn(userId: string, ip?: string) {
    return backend.ft.reserveFreeTrialTurn(req(ip), userId);
  }

  it("gibt genau FREE_TRIAL.prompts fertige Prompts, danach ist er aufgebraucht", async () => {
    expect(await backend.ft.freePromptsLeft("u1")).toBe(FREE_TRIAL.prompts);
    for (let i = FREE_TRIAL.prompts - 1; i >= 0; i--) {
      const slot = await turn("u1");
      if (typeof slot === "string") throw new Error(slot);
      expect(await slot.promptDelivered(`Prompt ${i}`)).toBe(i);
    }
    expect(await turn("u1")).toBe("exhausted");
    expect(await backend.ft.freePromptsLeft("u1")).toBe(0);
  });

  it("zählt eine Rückfrage als Zug, nicht als Prompt, und hört nach FREE_TRIAL.turns Zügen auf", async () => {
    for (let i = 0; i < FREE_TRIAL.turns; i++) {
      const slot = await turn("u2", `192.0.2.${i}`);
      if (typeof slot === "string") throw new Error(slot);
      expect(await slot.promptsLeft()).toBe(i + 1 < FREE_TRIAL.turns ? FREE_TRIAL.prompts : 0);
    }
    expect(await turn("u2", "198.51.100.1")).toBe("exhausted");
  });

  it("ein gescheiterter Zug gibt seinen Platz zurück", async () => {
    for (let i = 0; i < FREE_TRIAL.turns + 3; i++) {
      const slot = await turn("u3");
      if (typeof slot === "string") throw new Error(`Zug ${i}: ${slot}`);
      await slot.release();
    }
  });

  it("begrenzt die Züge je IP und Tag, auch über neue Konten", async () => {
    for (let i = 0; i < backend.ft.FREE_TRIAL_TURNS_PER_IP_DAY; i++) {
      const slot = await turn(`konto-${i}`, "203.0.113.9");
      if (typeof slot === "string") throw new Error(slot);
    }
    expect(await turn("noch-ein-konto", "203.0.113.9")).toBe("budget");
    // Die Ablehnung hat dem neuen Konto nichts abgezogen.
    expect(await backend.ft.freePromptsLeft("noch-ein-konto")).toBe(FREE_TRIAL.prompts);
    expect(typeof (await turn("noch-ein-konto", "203.0.113.10"))).toBe("object");
  });

  it("hat ein eigenes Tagesbudget über alle Konten", async () => {
    vi.stubEnv("FREE_TRIAL_DAILY_CALLS", "2");
    expect(typeof (await turn("a", "192.0.2.1"))).toBe("object");
    expect(typeof (await turn("b", "192.0.2.2"))).toBe("object");
    expect(await turn("c", "192.0.2.3")).toBe("budget");
  });

  it("Probelauf: gilt nur einem Prompt, den Finn dem Konto geliefert hat", async () => {
    const { ft } = backend;
    const hash = ft.deliveredPromptHash("Rolle: Du bist ein Tutor.");
    expect(await ft.reserveFreeTrialTestRun(req(), "d1", hash)).toBe("notDelivered");

    const slot = await turn("d1");
    if (typeof slot === "string") throw new Error(slot);
    await slot.promptDelivered("Rolle: Du bist ein Tutor.\r\n");
    expect(typeof (await ft.reserveFreeTrialTestRun(req(), "d1", hash))).toBe("object");
    // Ein anderes Konto hat diesen Prompt nicht bekommen.
    expect(await ft.reserveFreeTrialTestRun(req(), "d2", hash)).toBe("notDelivered");
  });

  it("Probelauf: einer je Prompt, zählt weder als Prompt noch als Zug", async () => {
    backend.markDelivered("t1", "hash-a");
    const first = await backend.ft.reserveFreeTrialTestRun(req(), "t1", "hash-a");
    expect(typeof first).toBe("object");
    expect(await backend.ft.reserveFreeTrialTestRun(req(), "t1", "hash-a")).toBe("used");
    expect(await backend.ft.freePromptsLeft("t1")).toBe(FREE_TRIAL.prompts);
    // Ein Zug geht danach unverändert.
    expect(typeof (await turn("t1"))).toBe("object");
  });

  it("Probelauf: höchstens so viele wie Gratis-Prompts, und ein gescheiterter gibt seinen Platz zurück", async () => {
    for (const h of ["h0", "h1", "h2", "h3", "h-neu"]) backend.markDelivered("t2", h);
    const failed = await backend.ft.reserveFreeTrialTestRun(req(), "t2", "h0");
    if (typeof failed === "string") throw new Error(failed);
    await failed.release();
    for (let i = 0; i < FREE_TRIAL.prompts; i++) {
      expect(typeof (await backend.ft.reserveFreeTrialTestRun(req(), "t2", `h${i}`)), `h${i}`).toBe("object");
    }
    expect(await backend.ft.reserveFreeTrialTestRun(req(), "t2", "h-neu")).toBe("accountUsed");
  });

  it("Probelauf: zählt gegen das Tagesbudget des Rahmens", async () => {
    vi.stubEnv("FREE_TRIAL_DAILY_CALLS", "1");
    backend.markDelivered("t3", "h");
    expect(typeof (await backend.ft.reserveFreeTrialTestRun(req("192.0.2.7"), "t3", "h"))).toBe("object");
    expect(await turn("t4", "192.0.2.8")).toBe("budget");
  });
});

describe("Gratis-Rahmen in Produktion", () => {
  it("gibt es ohne Redis nicht (fail closed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const ft = await load(null);
    expect(await ft.freePromptsLeft("u4")).toBeNull();
    expect(await ft.reserveFreeTrialTurn(req(), "u4")).toBe("unavailable");
    expect(await ft.reserveFreeTrialTestRun(req(), "u4", "hash")).toBe("unavailable");
  });
});

describe("Gratis-Rahmen über Redis: Ablaufzeiten und Fehler", () => {
  let fake: ReturnType<typeof fakeRedis>;
  let ft: FreeTrial;
  beforeEach(async () => {
    fake = fakeRedis();
    ft = await load(fake.client);
  });

  async function deliveredTurn(userId: string, prompt: string, ip = "192.0.2.5") {
    const slot = await ft.reserveFreeTrialTurn(req(ip), userId);
    if (typeof slot === "string") throw new Error(slot);
    return { slot, left: await slot.promptDelivered(prompt) };
  }

  it("legt jeden Schlüssel mit seinem Ablauf an: Konto 400 Tage, IP und Tag zwei Tage", async () => {
    const { left } = await deliveredTurn("r1", "Rolle: Du bist ein Tutor.");
    expect(left).toBe(FREE_TRIAL.prompts - 1);
    expect(Object.fromEntries(fake.expiry)).toEqual({
      "free-trial:turns:r1": ACCOUNT_TTL,
      [`free-trial:ip:192.0.2.5:${DAY}`]: DAY_TTL,
      [`free-trial:day:${DAY}`]: DAY_TTL,
      "free-trial:delivered:r1": ACCOUNT_TTL,
      "free-trial:prompts:r1": ACCOUNT_TTL,
    });
    expect(fake.commands.sadd).toHaveBeenCalledWith("free-trial:delivered:r1", ft.deliveredPromptHash("Rolle: Du bist ein Tutor."));
  });

  it("ein weiterer Prompt zählt hoch, ohne den Ablauf des Zählers neu zu setzen (NX)", async () => {
    fake.expiry.set("free-trial:prompts:r2", 60);
    const { left } = await deliveredTurn("r2", "Erster Prompt");
    expect(left).toBe(FREE_TRIAL.prompts - 1);
    expect(fake.counters.get("free-trial:prompts:r2")).toBe(1);
    expect(fake.expiry.get("free-trial:prompts:r2")).toBe(60);
    expect(fake.commands.expire).toHaveBeenCalledWith("free-trial:prompts:r2", ACCOUNT_TTL, "NX");
  });

  it("ein Lesefehler sperrt den Rahmen, statt ihn zu öffnen, und reserviert nichts", async () => {
    fake.commands.get.mockRejectedValue(new Error("down"));
    expect(await ft.freePromptsLeft("r3")).toBeNull();
    expect(await ft.reserveFreeTrialTurn(req(), "r3")).toBe("unavailable");
    expect(fake.commands.incr).not.toHaveBeenCalled();
  });

  it("ein unlesbarer Stand gilt als Fehler, ein negativer als null", async () => {
    fake.commands.get.mockImplementation(async (key: string) => (key === "free-trial:prompts:r4" ? "kaputt" : null));
    expect(await ft.freePromptsLeft("r4")).toBeNull();
    expect(await ft.reserveFreeTrialTurn(req(), "r4")).toBe("unavailable");

    fake.commands.get.mockImplementation(async (key: string) => (key === "free-trial:prompts:r5" ? -2 : null));
    expect(await ft.freePromptsLeft("r5")).toBe(FREE_TRIAL.prompts);
  });

  it("scheitert das Hochzählen, nennt der Zug keine Zahl statt einer falschen", async () => {
    const slot = await ft.reserveFreeTrialTurn(req(), "r6");
    if (typeof slot === "string") throw new Error(slot);
    fake.commands.incr.mockRejectedValueOnce(new Error("down"));
    expect(await slot.promptDelivered("Ein Prompt")).toBeUndefined();
  });

  it("fällt Redis nach der Reservierung aus, nennt weder ein Zug noch ein Probelauf eine Zahl", async () => {
    const slot = await ft.reserveFreeTrialTurn(req(), "r10");
    if (typeof slot === "string") throw new Error(slot);
    fake.markDelivered("r10", "hash");
    const testRun = await ft.reserveFreeTrialTestRun(req(), "r10", "hash");
    if (typeof testRun === "string") throw new Error(testRun);
    fake.commands.get.mockRejectedValue(new Error("down"));
    expect(await slot.promptsLeft()).toBeUndefined();
    expect(await testRun.promptsLeft()).toBeUndefined();
    expect(await testRun.promptDelivered("Ein Prompt")).toBeUndefined();
  });

  it("scheitert das Merken, zählt der Prompt trotzdem, nur ohne Gratis-Probelauf", async () => {
    fake.commands.sadd.mockRejectedValueOnce(new Error("down"));
    const { left } = await deliveredTurn("r7", "Ein Prompt");
    expect(left).toBe(FREE_TRIAL.prompts - 1);
    expect(await ft.reserveFreeTrialTestRun(req(), "r7", ft.deliveredPromptHash("Ein Prompt"))).toBe("notDelivered");
  });

  it("ist die Liste der gelieferten Prompts nicht lesbar, gibt es keinen Probelauf", async () => {
    fake.commands.sismember.mockRejectedValueOnce(new Error("down"));
    expect(await ft.reserveFreeTrialTestRun(req(), "r8", "hash")).toBe("unavailable");
    expect(fake.commands.incr).not.toHaveBeenCalled();
  });

  it("scheitert eine Reservierung, gibt der Zug zurück, was er schon hatte", async () => {
    const incr = fake.commands.incr.getMockImplementation()!;
    fake.commands.incr.mockImplementation(async (key: string) => {
      if (key.startsWith("free-trial:day:")) throw new Error("down");
      return incr(key);
    });
    expect(await ft.reserveFreeTrialTurn(req("192.0.2.9"), "r9")).toBe("unavailable");
    expect(fake.counters.get("free-trial:turns:r9")).toBe(0);
    expect(fake.counters.get(`free-trial:ip:192.0.2.9:${DAY}`)).toBe(0);
  });
});

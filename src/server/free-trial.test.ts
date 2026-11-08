import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/security/redis-client", () => ({ redis: null }));
vi.mock("@/shared/lib/observability", () => ({ logWarning: vi.fn() }));

const { __resetFreeTrialMemoryForTests, freePromptsLeft, reserveFreeTrialTurn, FREE_TRIAL_TURNS_PER_IP_DAY } =
  await import("@/server/free-trial");
const { FREE_TRIAL } = await import("@/shared/lib/plans");

// Ohne Redis zählt in Tests und Entwicklung eine Map (free-trial.ts); dieselbe Logik läuft in Produktion über Redis.
const req = (ip = "192.0.2.1") => new Request("https://promptprinter.app/api/chat", { headers: { "x-forwarded-for": ip } });

async function turn(userId: string, ip?: string) {
  const slot = await reserveFreeTrialTurn(req(ip), userId);
  if (typeof slot === "string") return slot;
  return slot;
}

beforeEach(() => {
  __resetFreeTrialMemoryForTests();
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("FREE_TRIAL_DAILY_CALLS", "");
});

describe("Gratis-Rahmen", () => {
  it("gibt genau FREE_TRIAL.prompts fertige Prompts, danach ist er aufgebraucht", async () => {
    expect(await freePromptsLeft("u1")).toBe(FREE_TRIAL.prompts);
    for (let i = FREE_TRIAL.prompts - 1; i >= 0; i--) {
      const slot = await turn("u1");
      if (typeof slot === "string") throw new Error(slot);
      expect(await slot.promptDelivered()).toBe(i);
    }
    expect(await turn("u1")).toBe("exhausted");
    expect(await freePromptsLeft("u1")).toBe(0);
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
    for (let i = 0; i < FREE_TRIAL_TURNS_PER_IP_DAY; i++) {
      const slot = await turn(`konto-${i}`, "203.0.113.9");
      if (typeof slot === "string") throw new Error(slot);
    }
    expect(await turn("noch-ein-konto", "203.0.113.9")).toBe("budget");
    // Die Ablehnung hat dem neuen Konto nichts abgezogen.
    expect(await freePromptsLeft("noch-ein-konto")).toBe(FREE_TRIAL.prompts);
    expect(typeof (await turn("noch-ein-konto", "203.0.113.10"))).toBe("object");
  });

  it("hat ein eigenes Tagesbudget über alle Konten", async () => {
    vi.stubEnv("FREE_TRIAL_DAILY_CALLS", "2");
    expect(typeof (await turn("a", "192.0.2.1"))).toBe("object");
    expect(typeof (await turn("b", "192.0.2.2"))).toBe("object");
    expect(await turn("c", "192.0.2.3")).toBe("budget");
  });

  it("gibt es in Produktion ohne Redis nicht (fail closed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await freePromptsLeft("u4")).toBeNull();
    expect(await turn("u4")).toBe("unavailable");
    vi.unstubAllEnvs();
  });
});

describe("Probelauf im Gratis-Rahmen", () => {
  it("einer je Prompt, zählt weder als Prompt noch als Zug", async () => {
    const { reserveFreeTrialTestRun } = await import("@/server/free-trial");
    const first = await reserveFreeTrialTestRun(req(), "t1", "hash-a");
    expect(typeof first).toBe("object");
    expect(await reserveFreeTrialTestRun(req(), "t1", "hash-a")).toBe("used");
    expect(await freePromptsLeft("t1")).toBe(FREE_TRIAL.prompts);
    // Ein Zug geht danach unverändert.
    expect(typeof (await turn("t1"))).toBe("object");
  });

  it("höchstens so viele wie Gratis-Prompts, und ein gescheiterter gibt seinen Platz zurück", async () => {
    const { reserveFreeTrialTestRun } = await import("@/server/free-trial");
    const failed = await reserveFreeTrialTestRun(req(), "t2", "h0");
    if (typeof failed === "string") throw new Error(failed);
    await failed.release();
    for (let i = 0; i < FREE_TRIAL.prompts; i++) {
      expect(typeof (await reserveFreeTrialTestRun(req(), "t2", `h${i}`)), `h${i}`).toBe("object");
    }
    expect(await reserveFreeTrialTestRun(req(), "t2", "h-neu")).toBe("used");
  });

  it("zählt gegen das Tagesbudget des Rahmens", async () => {
    vi.stubEnv("FREE_TRIAL_DAILY_CALLS", "1");
    const { reserveFreeTrialTestRun } = await import("@/server/free-trial");
    expect(typeof (await reserveFreeTrialTestRun(req("192.0.2.7"), "t3", "h"))).toBe("object");
    expect(await turn("t4", "192.0.2.8")).toBe("budget");
  });
});

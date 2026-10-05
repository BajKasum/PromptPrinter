import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reserveFailoverCall: vi.fn(),
  logWarning: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/server/security/rate-limit", () => ({
  reserveFailoverCall: () => mocks.reserveFailoverCall(),
}));
vi.mock("@/shared/lib/observability", () => ({
  logWarning: (...args: unknown[]) => mocks.logWarning(...args),
  logEvent: (...args: unknown[]) => mocks.logEvent(...args),
  captureError: vi.fn(),
}));

import {
  BREAKER_CONFIG,
  callWithFailover,
  createBreaker,
  createMemoryStore,
  failoverEnabled,
  outageReason,
  streamWithFailover,
  type ServerProvider,
} from "./llm-failover";

// Ein Anbieterfehler in der Form, die llm.ts wirft: "<Anbieter> <Status>: <Detail>".
function httpError(status: number, detail = "boom"): Error {
  return new Error(`Z.ai ${status}: ${detail}`);
}

class NamedError extends Error {
  constructor(name: string, message = name) {
    super(message);
    this.name = name;
  }
}

describe("failoverEnabled", () => {
  it("braucht BEIDE Server-Keys", () => {
    expect(failoverEnabled({ ZAI_API_KEY: "z", GEMINI_API_KEY: "g" })).toBe(true);
    expect(failoverEnabled({ ZAI_API_KEY: "z", GEMINI_API_KEY: "" })).toBe(false);
    expect(failoverEnabled({ ZAI_API_KEY: "", GEMINI_API_KEY: "g" })).toBe(false);
    expect(failoverEnabled({ ZAI_API_KEY: "  ", GEMINI_API_KEY: "g" })).toBe(false);
    expect(failoverEnabled({})).toBe(false);
  });
});

describe("outageReason", () => {
  it.each([408, 425, 429, 500, 502, 503, 504, 520, 522, 529])("HTTP %i ist ein Ausfall", (status) => {
    expect(outageReason(httpError(status))).toBe(`http_${status}`);
  });

  it("ein Netzabbruch ist ein Ausfall", () => {
    expect(outageReason(new TypeError("fetch failed"))).toBe("network");
  });

  it("ein Zeitlimit ist ein Ausfall (llm-retry wiederholt es nie, ein anderer Anbieter schon)", () => {
    expect(outageReason(new DOMException("no first chunk", "TimeoutError"))).toBe("timeout");
  });

  // Falscher Key oder falsche Anfrage: Gemini haette dasselbe Problem, oder
  // der Failover verdeckte eine kaputte Konfiguration.
  it.each([400, 401, 403, 404, 422])("HTTP %i ist KEIN Ausfall", (status) => {
    expect(outageReason(httpError(status))).toBeNull();
  });

  // Das soll jemand SEHEN, nicht still auf eine teurere Rechnung umleiten.
  it.each([
    "Insufficient balance or no resource package. Please recharge.",
    "You exceeded your current quota, please check your plan and billing details.",
    "Your credit balance is too low",
  ])("ein 429 mit aufgebrauchtem Guthaben ist KEIN Ausfall: %s", (detail) => {
    expect(outageReason(httpError(429, detail))).toBeNull();
  });

  it("eine leere Antwort ist KEIN Ausfall (modellbedingt)", () => {
    expect(outageReason(new NamedError("LlmEmptyReplyError"))).toBeNull();
  });

  it("der Abbruch des Nutzers ist KEIN Ausfall", () => {
    expect(outageReason(new DOMException("aborted", "AbortError"))).toBeNull();
    expect(outageReason(new NamedError("AbortError"))).toBeNull();
  });

  it("ein unbekannter Fehler ist KEIN Ausfall", () => {
    expect(outageReason(new Error("something odd"))).toBeNull();
    expect(outageReason(undefined)).toBeNull();
  });
});

describe("Leistungsschalter", () => {
  let now = 0;
  const clock = () => now;
  const advance = (seconds: number) => {
    now += seconds * 1000;
  };

  function newBreaker() {
    return createBreaker(createMemoryStore(clock));
  }

  beforeEach(() => {
    now = 1_000_000;
    mocks.logWarning.mockClear();
    mocks.logEvent.mockClear();
  });

  it("ist am Anfang zu: der erste Zug geht zu Z.ai", async () => {
    expect(await newBreaker().pick()).toEqual({ provider: "zai", probe: false });
  });

  it("zwei Fehlschlaege oeffnen ihn nicht, der dritte schon", async () => {
    const breaker = newBreaker();
    await breaker.recordFailure();
    await breaker.recordFailure();
    expect((await breaker.pick()).provider).toBe("zai");

    await breaker.recordFailure();
    expect(await breaker.pick()).toEqual({ provider: "gemini", probe: false });
    expect(mocks.logWarning).toHaveBeenCalledWith(
      "llm.breaker_open",
      expect.objectContaining({ reason: "threshold", failures: 3 })
    );
  });

  it("Fehlschlaege ausserhalb des Fensters zaehlen nicht zusammen", async () => {
    const breaker = newBreaker();
    await breaker.recordFailure();
    await breaker.recordFailure();
    advance(BREAKER_CONFIG.failureWindowSeconds + 1);
    await breaker.recordFailure();
    expect((await breaker.pick()).provider).toBe("zai");
  });

  it("bleibt offen, solange die Pause laeuft, und gibt danach einen Probeaufruf frei", async () => {
    const breaker = newBreaker();
    for (let i = 0; i < 3; i++) await breaker.recordFailure();

    advance(BREAKER_CONFIG.openSeconds - 1);
    expect((await breaker.pick()).provider).toBe("gemini");

    advance(2);
    expect(await breaker.pick()).toEqual({ provider: "zai", probe: true });
  });

  it("ein gescheiterter Probeaufruf oeffnet sofort wieder, ohne drei neue Zuege zu brauchen", async () => {
    const breaker = newBreaker();
    for (let i = 0; i < 3; i++) await breaker.recordFailure();
    advance(BREAKER_CONFIG.openSeconds + 1);
    expect((await breaker.pick()).probe).toBe(true);

    await breaker.recordFailure();

    expect((await breaker.pick()).provider).toBe("gemini");
    expect(mocks.logWarning).toHaveBeenLastCalledWith(
      "llm.breaker_open",
      expect.objectContaining({ reason: "probe_failed" })
    );
  });

  it("ein gelungener Probeaufruf schliesst ihn, und ein Fehler danach braucht wieder drei", async () => {
    const breaker = newBreaker();
    for (let i = 0; i < 3; i++) await breaker.recordFailure();
    advance(BREAKER_CONFIG.openSeconds + 1);
    const probe = await breaker.pick();
    expect(probe.probe).toBe(true);

    await breaker.recordSuccess(probe.probe);
    expect(await breaker.pick()).toEqual({ provider: "zai", probe: false });
    expect(mocks.logEvent).toHaveBeenCalledWith("llm.breaker_closed", expect.anything());

    await breaker.recordFailure();
    expect((await breaker.pick()).provider).toBe("zai");
  });

  it("ein gewoehnlicher Erfolg aendert nichts (kein Schreibzugriff pro Zug)", async () => {
    const store = createMemoryStore(clock);
    const del = vi.spyOn(store, "del");
    const breaker = createBreaker(store);
    await breaker.recordSuccess(false);
    expect(del).not.toHaveBeenCalled();
  });

  it("faellt ein Speicher-Zugriff aus, gilt der Schalter als zu (wie bisher zuerst Z.ai)", async () => {
    const store = createMemoryStore(clock);
    vi.spyOn(store, "exists").mockRejectedValue(new Error("redis down"));
    vi.spyOn(store, "incr").mockRejectedValue(new Error("redis down"));
    const breaker = createBreaker(store);

    expect(await breaker.pick()).toEqual({ provider: "zai", probe: false });
    await expect(breaker.recordFailure()).resolves.toBeUndefined();
  });
});

describe("streamWithFailover", () => {
  let now = 0;

  async function collect(stream: AsyncGenerator<string>): Promise<string> {
    let out = "";
    for await (const chunk of stream) out += chunk;
    return out;
  }

  /** Ein Stream, der erst die genannten Stuecke liefert und dann mit `error` endet (oder sauber). */
  function scripted(chunks: string[], error?: unknown): () => AsyncGenerator<string> {
    return async function* () {
      for (const chunk of chunks) yield chunk;
      if (error) throw error;
    };
  }

  function setup(runs: { zai: () => AsyncGenerator<string>; gemini?: () => AsyncGenerator<string> }) {
    const calls: ServerProvider[] = [];
    const providers: ServerProvider[] = [];
    const breaker = createBreaker(createMemoryStore(() => now));
    const run = (provider: ServerProvider) => {
      calls.push(provider);
      const fn = provider === "zai" ? runs.zai : (runs.gemini ?? scripted(["gemini-antwort"]));
      return fn();
    };
    return { calls, providers, breaker, run, onProvider: (p: ServerProvider) => providers.push(p) };
  }

  beforeEach(() => {
    now = 1_000_000;
    mocks.reserveFailoverCall.mockReset();
    mocks.reserveFailoverCall.mockResolvedValue({ allowed: true, release: vi.fn(async () => {}) });
    mocks.logWarning.mockClear();
    mocks.logEvent.mockClear();
  });

  it("ohne Ausfall laeuft alles auf Z.ai, Gemini wird nicht angefasst", async () => {
    const { calls, providers, breaker, run, onProvider } = setup({ zai: scripted(["Hallo ", "Welt"]) });

    const text = await collect(streamWithFailover(run, { breaker, onProvider }));

    expect(text).toBe("Hallo Welt");
    expect(calls).toEqual(["zai"]);
    expect(providers).toEqual(["zai"]);
    expect(mocks.reserveFailoverCall).not.toHaveBeenCalled();
  });

  // Der Kern: ein simulierter Z.ai-Ausfall loest den Wechsel aus.
  it("ein Ausfall von Z.ai vor dem ersten Textstueck schaltet auf Gemini um und meldet es im Log", async () => {
    const { calls, providers, breaker, run, onProvider } = setup({
      zai: scripted([], httpError(503, "overloaded")),
    });

    const text = await collect(streamWithFailover(run, { breaker, onProvider }));

    expect(text).toBe("gemini-antwort");
    expect(calls).toEqual(["zai", "gemini"]);
    expect(providers).toEqual(["zai", "gemini"]);
    expect(mocks.logWarning).toHaveBeenCalledWith(
      "llm.failover",
      expect.objectContaining({ from: "zai", to: "gemini", reason: "http_503" })
    );
  });

  it("ein Zeitlimit beim ersten Textstueck schaltet ebenfalls um", async () => {
    const { calls, breaker, run } = setup({
      zai: scripted([], new DOMException("no first chunk within 30000 ms", "TimeoutError")),
    });

    const text = await collect(streamWithFailover(run, { breaker }));

    expect(text).toBe("gemini-antwort");
    expect(calls).toEqual(["zai", "gemini"]);
    expect(mocks.logWarning).toHaveBeenCalledWith("llm.failover", expect.objectContaining({ reason: "timeout" }));
  });

  // Das Gegenstueck: diese Fehler duerfen den Wechsel NICHT ausloesen.
  it.each([
    ["falscher Key (401)", httpError(401, "invalid api key")],
    ["Zugriff verweigert (403)", httpError(403)],
    ["falsche Anfrage (400)", httpError(400, "bad request")],
    ["Guthaben aufgebraucht (429)", httpError(429, "Insufficient balance or no resource package")],
    ["leere Antwort", new NamedError("LlmEmptyReplyError")],
    ["unbekannter Fehler", new Error("irgendwas")],
  ])("%s schaltet NICHT um, der Fehler bleibt stehen", async (_name, error) => {
    const { calls, breaker, run } = setup({ zai: scripted([], error) });

    await expect(collect(streamWithFailover(run, { breaker }))).rejects.toBe(error);

    expect(calls).toEqual(["zai"]);
    expect(mocks.reserveFailoverCall).not.toHaveBeenCalled();
    expect(mocks.logWarning).not.toHaveBeenCalledWith("llm.failover", expect.anything());
  });

  it("zaehlt so einen Fehler auch nicht gegen den Leistungsschalter", async () => {
    const { breaker, run } = setup({ zai: scripted([], httpError(401)) });
    for (let i = 0; i < 5; i++) {
      await collect(streamWithFailover(run, { breaker })).catch(() => undefined);
    }
    expect((await breaker.pick()).provider).toBe("zai");
  });

  it("schaltet nicht mehr um, sobald ein Textstueck beim Nutzer angekommen ist", async () => {
    const error = httpError(503);
    const { calls, breaker, run } = setup({ zai: scripted(["Hallo "], error) });
    const received: string[] = [];

    await expect(
      (async () => {
        for await (const chunk of streamWithFailover(run, { breaker })) received.push(chunk);
      })()
    ).rejects.toBe(error);

    // Der Nutzer behaelt, was er gelesen hat, und es beginnt nichts von vorn.
    expect(received).toEqual(["Hallo "]);
    expect(calls).toEqual(["zai"]);
  });

  it("schaltet nicht um, wenn der Nutzer selbst abgebrochen hat", async () => {
    const controller = new AbortController();
    controller.abort();
    const { calls, breaker, run } = setup({ zai: scripted([], httpError(503)) });

    await expect(collect(streamWithFailover(run, { breaker, signal: controller.signal }))).rejects.toThrow();

    expect(calls).toEqual(["zai"]);
  });

  it("scheitert auch Gemini, kommt dessen Fehler an und der Platz im Failover-Budget geht zurueck", async () => {
    const release = vi.fn(async () => {});
    mocks.reserveFailoverCall.mockResolvedValue({ allowed: true, release });
    const geminiError = httpError(500, "gemini down");
    const { breaker, run } = setup({
      zai: scripted([], httpError(503)),
      gemini: scripted([], geminiError),
    });

    await expect(collect(streamWithFailover(run, { breaker }))).rejects.toBe(geminiError);

    expect(release).toHaveBeenCalledTimes(1);
  });

  it("ein Erfolg auf Gemini behaelt den Platz im Failover-Budget", async () => {
    const release = vi.fn(async () => {});
    mocks.reserveFailoverCall.mockResolvedValue({ allowed: true, release });
    const { breaker, run } = setup({ zai: scripted([], httpError(503)) });

    await collect(streamWithFailover(run, { breaker }));

    expect(release).not.toHaveBeenCalled();
  });

  it("ist das Failover-Tagesbudget aufgebraucht, bleibt der Z.ai-Fehler stehen", async () => {
    const release = vi.fn(async () => {});
    mocks.reserveFailoverCall.mockResolvedValue({ allowed: false, release });
    const error = httpError(503);
    const { calls, breaker, run } = setup({ zai: scripted([], error) });

    await expect(collect(streamWithFailover(run, { breaker }))).rejects.toBe(error);

    expect(calls).toEqual(["zai"]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("ohne Redis (reserveFailoverCall liefert null) gilt keine Obergrenze", async () => {
    mocks.reserveFailoverCall.mockResolvedValue(null);
    const { calls, breaker, run } = setup({ zai: scripted([], httpError(502)) });

    expect(await collect(streamWithFailover(run, { breaker }))).toBe("gemini-antwort");
    expect(calls).toEqual(["zai", "gemini"]);
  });

  it("drei gescheiterte Zuege oeffnen den Schalter, der naechste geht gar nicht erst zu Z.ai", async () => {
    const { calls, breaker, run } = setup({ zai: scripted([], httpError(503)) });

    for (let i = 0; i < 3; i++) await collect(streamWithFailover(run, { breaker }));
    expect(calls).toEqual(["zai", "gemini", "zai", "gemini", "zai", "gemini"]);

    calls.length = 0;
    expect(await collect(streamWithFailover(run, { breaker }))).toBe("gemini-antwort");
    expect(calls).toEqual(["gemini"]);
  });

  it("bei offenem Schalter und aufgebrauchtem Budget wird Z.ai doch noch gefragt", async () => {
    const { calls, breaker, run } = setup({ zai: scripted(["wieder da"]) });
    for (let i = 0; i < 3; i++) await breaker.recordFailure();
    mocks.reserveFailoverCall.mockResolvedValue({ allowed: false, release: vi.fn(async () => {}) });

    expect(await collect(streamWithFailover(run, { breaker }))).toBe("wieder da");
    expect(calls).toEqual(["zai"]);
  });

  it("nach der Pause schliesst ein gelungener Probeaufruf den Schalter", async () => {
    const { calls, breaker, run } = setup({ zai: scripted(["Z.ai lebt"]) });
    for (let i = 0; i < 3; i++) await breaker.recordFailure();
    now += (BREAKER_CONFIG.openSeconds + 1) * 1000;

    expect(await collect(streamWithFailover(run, { breaker }))).toBe("Z.ai lebt");
    expect(calls).toEqual(["zai"]);
    expect(await breaker.pick()).toEqual({ provider: "zai", probe: false });
  });
});

describe("callWithFailover", () => {
  beforeEach(() => {
    mocks.reserveFailoverCall.mockReset();
    mocks.reserveFailoverCall.mockResolvedValue({ allowed: true, release: vi.fn(async () => {}) });
    mocks.logWarning.mockClear();
  });

  it("schaltet bei einem Ausfall auf Gemini um", async () => {
    const breaker = createBreaker(createMemoryStore());
    const run = vi.fn(async (provider: ServerProvider) => {
      if (provider === "zai") throw httpError(503);
      return "gemini";
    });

    await expect(callWithFailover(run, { breaker })).resolves.toBe("gemini");
    expect(run.mock.calls.map((c) => c[0])).toEqual(["zai", "gemini"]);
  });

  it("schaltet bei einem falschen Key NICHT um", async () => {
    const breaker = createBreaker(createMemoryStore());
    const error = httpError(401);
    const run = vi.fn(async () => {
      throw error;
    });

    await expect(callWithFailover(run, { breaker })).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

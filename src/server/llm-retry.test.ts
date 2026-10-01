import { describe, expect, it, vi } from "vitest";
import { LlmEmptyReplyError } from "@/server/llm";
import {
  DEFAULT_RETRY_POLICY,
  attemptsOf,
  extractRetryAfterMs,
  nextDelayMs,
  parseRetryAfter,
  retryStream,
  transientReason,
  withRetry,
  type RetryEvent,
} from "./llm-retry";

// Ein Anbieterfehler in der Form, die llm.ts wirft: "<Anbieter> <Status>: <Detail>".
function httpError(status: number, detail = "boom"): Error {
  return new Error(`Z.ai ${status}: ${detail}`);
}

/** Schläft nicht, sondern merkt sich die Wartezeiten. */
function fakeSleep() {
  const waits: number[] = [];
  const sleep = vi.fn(async (ms: number) => {
    waits.push(ms);
  });
  return { sleep, waits };
}

const noJitter = () => 1;

describe("transientReason", () => {
  it.each([408, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529])(
    "wiederholt HTTP %i",
    (status) => {
      expect(transientReason(httpError(status))).toBe(`http_${status}`);
    }
  );

  it.each([400, 401, 403, 404, 422, 501, 505])("wiederholt HTTP %i nicht", (status) => {
    expect(transientReason(httpError(status))).toBeNull();
  });

  it("liest den Status auch von einem SDK-Fehlerobjekt", () => {
    expect(transientReason(Object.assign(new Error("Overloaded"), { status: 529 }))).toBe("http_529");
    expect(transientReason(Object.assign(new Error("bad key"), { status: 401 }))).toBeNull();
  });

  // Aufgebrauchtes Guthaben ist kein "gleich nochmal": der Nutzer soll die
  // Meldung sofort sehen, nicht erst nach drei Versuchen.
  it.each([
    "Insufficient balance or no resource package. Please recharge.",
    "You exceeded your current quota, please check your plan and billing details.",
    "Your credit balance is too low",
  ])("wiederholt ein 429 mit aufgebrauchtem Guthaben nicht: %s", (detail) => {
    expect(transientReason(httpError(429, detail))).toBeNull();
  });

  it("wiederholt ein gewöhnliches Ratenlimit", () => {
    expect(transientReason(httpError(429, "Rate limit reached for requests"))).toBe("http_429");
  });

  it("erkennt einen abgerissenen Netzwerkaufruf, auch tief in der Ursache", () => {
    const cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const err = new TypeError("fetch failed", { cause });

    expect(transientReason(err)).toBe("network");
    expect(transientReason(new TypeError("fetch failed"))).toBe("network");
    expect(transientReason(new Error("socket hang up"))).toBe("network");
  });

  it("erkennt den Verbindungsfehler der SDKs, nicht aber deren Zeitlimit", () => {
    class APIConnectionError extends Error {}
    class APIConnectionTimeoutError extends Error {}

    expect(transientReason(new APIConnectionError("Connection error."))).toBe("network");
    expect(transientReason(new APIConnectionTimeoutError("Request timed out."))).toBeNull();
  });

  it("wiederholt nie einen Abbruch, ein Zeitlimit oder eine leere Antwort", () => {
    expect(transientReason(new DOMException("aborted", "AbortError"))).toBeNull();
    expect(transientReason(new DOMException("timed out", "TimeoutError"))).toBeNull();
    expect(transientReason(new LlmEmptyReplyError("Z.ai"))).toBeNull();
  });

  it("wiederholt nichts, was nicht wie ein Anbieterfehler aussieht", () => {
    expect(transientReason(new Error("Antwort überschreitet das Limit von 2000000 Bytes."))).toBeNull();
    expect(transientReason(new Error("something odd happened"))).toBeNull();
    expect(transientReason(undefined)).toBeNull();
    expect(transientReason("503")).toBeNull();
  });
});

describe("Retry-After", () => {
  it("liest Sekunden und Datumsangaben", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("0.5")).toBe(500);
    const now = Date.parse("2026-10-01T12:00:00Z");
    expect(parseRetryAfter("Thu, 01 Oct 2026 12:00:03 GMT", now)).toBe(3000);
    expect(parseRetryAfter("Thu, 01 Oct 2026 11:59:00 GMT", now)).toBe(0);
  });

  it("nimmt Unlesbares als nicht angegeben", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("bald")).toBeNull();
  });

  it("findet den Wert an unseren Fehlern und an SDK-Fehlern mit Headers-Objekt oder Record", () => {
    expect(extractRetryAfterMs(Object.assign(new Error("x"), { retryAfterMs: 1500 }))).toBe(1500);
    expect(
      extractRetryAfterMs({ headers: new Headers({ "retry-after": "3" }) })
    ).toBe(3000);
    expect(extractRetryAfterMs({ headers: { "retry-after": "4" } })).toBe(4000);
    expect(extractRetryAfterMs(new Error("x"))).toBeNull();
    expect(extractRetryAfterMs(null)).toBeNull();
  });
});

describe("nextDelayMs", () => {
  const policy = DEFAULT_RETRY_POLICY;

  it("gibt nach dem letzten Versuch auf", () => {
    expect(nextDelayMs(policy.maxAttempts, policy, null)).toBeNull();
  });

  it("verdoppelt die Wartezeit und hält die Obergrenze", () => {
    // Ohne Zufall (random = 1) ist es die volle Obergrenze des jeweiligen Schritts.
    expect(nextDelayMs(1, { ...policy, maxAttempts: 9 }, null, noJitter)).toBe(700);
    expect(nextDelayMs(2, { ...policy, maxAttempts: 9 }, null, noJitter)).toBe(1400);
    expect(nextDelayMs(3, { ...policy, maxAttempts: 9 }, null, noJitter)).toBe(2800);
    expect(nextDelayMs(4, { ...policy, maxAttempts: 9 }, null, noJitter)).toBe(4000);
    expect(nextDelayMs(8, { ...policy, maxAttempts: 9 }, null, noJitter)).toBe(4000);
  });

  it("wartet mindestens die halbe Zeit und höchstens die ganze (Equal Jitter)", () => {
    expect(nextDelayMs(1, policy, null, () => 0)).toBe(350);
    expect(nextDelayMs(1, policy, null, () => 0.5)).toBe(525);
    expect(nextDelayMs(1, policy, null, () => 1)).toBe(700);
  });

  it("folgt dem Retry-After des Anbieters, solange es unter der Obergrenze liegt", () => {
    expect(nextDelayMs(1, policy, 1200)).toBe(1200);
    expect(nextDelayMs(1, policy, 0)).toBe(0);
  });

  it("gibt auf, statt länger als die Obergrenze zu warten", () => {
    expect(nextDelayMs(1, policy, 30_000)).toBeNull();
  });
});

describe("withRetry", () => {
  it("gibt das Ergebnis eines gelungenen ersten Versuchs ohne Warten zurück", async () => {
    const { sleep } = fakeSleep();
    const fn = vi.fn(async () => "ok");

    await expect(withRetry(fn, { sleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("versucht es nach einem 503 noch einmal und liefert dann das Ergebnis", async () => {
    const { sleep, waits } = fakeSleep();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce("ok");

    await expect(withRetry(fn, { sleep, random: noJitter })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([700]);
  });

  it("gibt nach drei Versuchen auf und wirft den letzten Fehler, mit der Zahl der Versuche", async () => {
    const { sleep, waits } = fakeSleep();
    const last = httpError(503, "still down");
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(httpError(502))
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(last);

    const caught = await withRetry(fn, { sleep, random: noJitter }).catch((e) => e);

    expect(caught).toBe(last);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([700, 1400]);
    expect(attemptsOf(caught)).toBe(3);
  });

  it("wiederholt einen falschen Key nicht, und meldet einen Versuch", async () => {
    const { sleep } = fakeSleep();
    const fn = vi.fn(async () => {
      throw httpError(401, "invalid api key");
    });

    const caught = await withRetry(fn, { sleep }).catch((e) => e);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(attemptsOf(caught)).toBe(1);
  });

  it("richtet sich nach dem Retry-After des Anbieters", async () => {
    const { sleep, waits } = fakeSleep();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(httpError(429, "Rate limit"), { retryAfterMs: 1800 }))
      .mockResolvedValueOnce("ok");

    await withRetry(fn, { sleep });
    expect(waits).toEqual([1800]);
  });

  it("wartet nicht auf einen Anbieter, der 30 Sekunden verlangt", async () => {
    const { sleep } = fakeSleep();
    const fn = vi.fn(async () => {
      throw Object.assign(httpError(429, "Rate limit"), { retryAfterMs: 30_000 });
    });

    await expect(withRetry(fn, { sleep })).rejects.toThrow("429");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("meldet vor jedem Warten, was passiert, ohne Nutzertext", async () => {
    const { sleep } = fakeSleep();
    const events: RetryEvent[] = [];
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(httpError(503, "geheimer Detailtext"))
      .mockResolvedValueOnce("ok");

    await withRetry(fn, { sleep, random: noJitter, onRetry: (e) => events.push(e) });

    expect(events).toEqual([{ failedAttempt: 1, maxAttempts: 3, delayMs: 700, reason: "http_503" }]);
    expect(JSON.stringify(events)).not.toContain("geheimer Detailtext");
  });

  it("wiederholt nach einem Abbruch durch den Nutzer nicht mehr", async () => {
    const { sleep } = fakeSleep();
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      controller.abort();
      throw httpError(503);
    });

    await expect(withRetry(fn, { sleep, signal: controller.signal })).rejects.toThrow("503");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("beachtet eine eigene Obergrenze der Versuche", async () => {
    const { sleep } = fakeSleep();
    const fn = vi.fn(async () => {
      throw httpError(503);
    });

    await expect(withRetry(fn, { sleep, policy: { maxAttempts: 1 } })).rejects.toThrow("503");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const chunk of gen) out += chunk;
  return out;
}

describe("retryStream", () => {
  it("wiederholt, wenn der Fehler vor dem ersten Textstück kommt", async () => {
    const { sleep, waits } = fakeSleep();
    let call = 0;
    const start = async function* () {
      call += 1;
      if (call === 1) throw httpError(503);
      yield "Hallo ";
      yield "Welt";
    };

    await expect(collect(retryStream(start, { sleep, random: noJitter }))).resolves.toBe("Hallo Welt");
    expect(call).toBe(2);
    expect(waits).toEqual([700]);
  });

  // Der Kern der Sache: ein Wort ist beim Nutzer angekommen, ein neuer Versuch
  // würde den Text von vorn schreiben und das Gelesene verdoppeln.
  it("wiederholt nicht mehr, sobald ein Textstück geliefert wurde", async () => {
    const { sleep } = fakeSleep();
    let call = 0;
    const start = async function* () {
      call += 1;
      yield "Hallo ";
      throw httpError(503);
    };

    const received: string[] = [];
    const run = async () => {
      for await (const chunk of retryStream(start, { sleep })) received.push(chunk);
    };

    await expect(run()).rejects.toThrow("503");
    expect(received).toEqual(["Hallo "]);
    expect(call).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gibt nach drei Versuchen auf", async () => {
    const { sleep } = fakeSleep();
    let call = 0;
    const start = async function* (): AsyncGenerator<string> {
      call += 1;
      throw httpError(502);
    };

    const caught = await collect(retryStream(start, { sleep, random: noJitter })).catch((e) => e);

    expect(call).toBe(3);
    expect(attemptsOf(caught)).toBe(3);
  });

  it("wiederholt einen falschen Key nicht", async () => {
    const { sleep } = fakeSleep();
    let call = 0;
    const start = async function* (): AsyncGenerator<string> {
      call += 1;
      throw httpError(401);
    };

    await expect(collect(retryStream(start, { sleep }))).rejects.toThrow("401");
    expect(call).toBe(1);
  });

  it("meldet jeden Wiederholungsversuch", async () => {
    const { sleep } = fakeSleep();
    const events: RetryEvent[] = [];
    let call = 0;
    const start = async function* () {
      call += 1;
      if (call < 3) throw httpError(503);
      yield "ok";
    };

    await collect(retryStream(start, { sleep, random: noJitter, onRetry: (e) => events.push(e) }));

    expect(events.map((e) => e.failedAttempt)).toEqual([1, 2]);
  });

  it("bricht das Warten ab, wenn der Nutzer in der Pause abbricht", async () => {
    const controller = new AbortController();
    const start = async function* (): AsyncGenerator<string> {
      throw httpError(503);
    };
    // Ein echtes Warten, das auf das Signal hört: die Pause wäre sonst 350 bis 700 ms lang.
    const startedAt = Date.now();
    setTimeout(() => controller.abort(new DOMException("stopped", "AbortError")), 20);

    await expect(
      collect(retryStream(start, { signal: controller.signal, random: () => 1 }))
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(Date.now() - startedAt).toBeLessThan(400);
  });
});

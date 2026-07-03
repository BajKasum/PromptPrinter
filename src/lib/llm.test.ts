import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompleteSequential, llmConfig } from "@/lib/llm";

// llmConfig reads process.env at call time, so stubbing per test is enough —
// no module re-import dance needed.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockResponse(status: number, bodyText: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  } as unknown as Response;
}

const OK_BODY = JSON.stringify({ choices: [{ message: { content: "ok" } }] });
const RATE_LIMIT_BODY = JSON.stringify({
  error: { code: "1302", message: "Rate limit reached for requests" },
});

describe("llmConfig", () => {
  it("returns null when no provider key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(llmConfig()).toBeNull();
  });

  it("prefers Z.ai when its key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "also-set");
    expect(llmConfig()).toEqual({ provider: "zai", model: "glm-5-turbo" });
  });

  it("honors the ZAI_MODEL override", () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubEnv("ZAI_MODEL", "glm-5.2");
    expect(llmConfig()).toEqual({ provider: "zai", model: "glm-5.2" });
  });

  it("falls back to Gemini when only its key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gem-key");
    expect(llmConfig()).toEqual({ provider: "gemini", model: "gemini-3.5-flash" });
  });
});

describe("chatCompleteSequential", () => {
  it("runs prompts strictly one at a time, never overlapping", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = vi.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return mockResponse(200, OK_BODY);
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await chatCompleteSequential("sys", { a: "p1", b: "p2", c: "p3" });

    expect(maxInFlight).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(results.a.result?.text).toBe("ok");
    expect(results.b.result?.text).toBe("ok");
    expect(results.c.result?.text).toBe("ok");
  });

  it("retries a 429 with backoff and keeps the result once it succeeds", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      return calls === 1 ? mockResponse(429, RATE_LIMIT_BODY) : mockResponse(200, OK_BODY);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const promise = chatCompleteSequential("sys", { a: "p1" });
    await vi.advanceTimersByTimeAsync(1000);
    const results = await promise;

    expect(calls).toBe(2);
    expect(results.a.result?.text).toBe("ok");
    expect(results.a.error).toBeUndefined();
  });

  it("gives up after exhausting retries on a persistent 429", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => mockResponse(429, RATE_LIMIT_BODY));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const promise = chatCompleteSequential("sys", { a: "p1" });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    const results = await promise;

    // 1 initial attempt + 3 retries.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(results.a.result).toBeUndefined();
    expect(results.a.error).toBeInstanceOf(Error);
    expect((results.a.error as Error).message).toContain("429");
  });

  it("does not retry a non-429 error", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      mockResponse(500, JSON.stringify({ error: { message: "server exploded" } }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await chatCompleteSequential("sys", { a: "p1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.a.error).toBeInstanceOf(Error);
  });
});

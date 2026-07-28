import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chatComplete,
  chatCompleteStream,
  llmConfig,
  LlmEmptyReplyError,
  classifyLlmFailure,
} from "@/lib/llm";

// customComplete (the 'custom' BYOK provider) resolves its endpoint through
// url-safety.ts's SSRF check before every fetch; stub DNS to a public address
// by default so the existing custom-provider tests below don't depend on real
// network resolution. Tests that specifically exercise the SSRF guard
// override this per-case.
const lookupMock = vi.fn<(...args: unknown[]) => Promise<{ address: string; family: number }[]>>(
  async () => [{ address: "93.184.216.34", family: 4 }]
);
vi.mock("node:dns", () => ({
  promises: { lookup: (...args: unknown[]) => lookupMock(...args) },
}));

// llmConfig reads process.env at call time, so stubbing per test is enough,
// no module re-import dance needed.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  lookupMock.mockClear();
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

describe("llmConfig", () => {
  it("returns null when no provider key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(llmConfig()).toBeNull();
  });

  it("prefers Z.ai when its key is set", () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "also-set");
    expect(llmConfig()).toEqual({ provider: "zai", model: "glm-4.5-air" });
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

// BYOK's "custom" provider, any OpenAI-compatible endpoint the user names
// themselves (Z.ai, DeepSeek, Groq, OpenRouter, …). No server key involved;
// the endpoint/model/key all come from the override.
describe("chatComplete: custom BYOK override", () => {
  it("posts to the user's own endpoint and model, with their key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return mockResponse(200, OK_BODY);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatComplete({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      override: {
        provider: "custom",
        apiKey: "user-key",
        baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
        model: "glm-4.6",
      },
    });

    expect(result.text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect((capturedInit.headers as Record<string, string>).authorization).toBe("Bearer user-key");
    const body = JSON.parse(capturedInit.body as string);
    expect(body.model).toBe("glm-4.6");
    expect(body.thinking).toBeUndefined();
  });

  it("throws LlmEmptyReplyError when the endpoint returns no content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(200, JSON.stringify({ choices: [{ message: {} }] })))
    );

    await expect(
      chatComplete({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "https://example.test/v1/chat/completions",
          model: "some-model",
        },
      })
    ).rejects.toBeInstanceOf(LlmEmptyReplyError);
  });

  it("surfaces the provider's error message on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockResponse(401, JSON.stringify({ error: { message: "invalid api key" } }))
      )
    );

    await expect(
      chatComplete({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "bad-key",
          baseUrl: "https://example.test/v1/chat/completions",
          model: "some-model",
        },
      })
    ).rejects.toThrow("invalid api key");
  });

  // SSRF guard (url-safety.ts): a custom baseUrl is attacker-controlled, so
  // it's checked before every fetch, not only when it's first saved.
  it("refuses a baseUrl that resolves to a private/metadata address, without ever fetching", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      chatComplete({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "https://sneaky.example/v1/chat/completions",
          model: "some-model",
        },
      })
    ).rejects.toThrow("nicht erlaubt");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a non-https baseUrl, without ever fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      chatComplete({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "http://example.com/v1/chat/completions",
          model: "some-model",
        },
      })
    ).rejects.toThrow("Nur https://");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak an unparsed response body into the thrown error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(500, "iam-role-credentials-secret-payload"))
    );

    let caught: unknown;
    try {
      await chatComplete({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "https://example.test/v1/chat/completions",
          model: "some-model",
        },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain("iam-role-credentials-secret-payload");
  });

  // Outbound-fetch hardening (4.3): an arbitrary user-supplied endpoint gets
  // a request timeout and a response-size cap Z.ai's own fixed endpoint
  // doesn't need, see the block comment above customComplete in llm.ts.
  it("attaches an AbortSignal to the custom provider's fetch call", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedSignal = init.signal as AbortSignal;
        return mockResponse(200, OK_BODY);
      })
    );

    await chatComplete({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      override: {
        provider: "custom",
        apiKey: "user-key",
        baseUrl: "https://example.test/v1/chat/completions",
        model: "some-model",
      },
    });

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("throws once the custom provider's response exceeds the size cap", async () => {
    // Content doesn't need to be valid JSON, the byte cap is checked on raw
    // chunks as they arrive, before any parsing.
    const oversized = new Uint8Array(2_000_001).fill(32);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, statusText: "", body: stream, text: async () => "" }))
    );

    await expect(
      chatComplete({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "https://example.test/v1/chat/completions",
          model: "some-model",
        },
      })
    ).rejects.toThrow("überschreitet das Limit");
  });
});

// chatCompleteStream, /api/chat's streaming path. Only the fetch-based Z.ai/
// custom providers are covered here, mirroring chatComplete's own testing
// boundary above: the SDK-based providers (Anthropic/OpenAI/Gemini) aren't
// unit-tested at this layer either way, streaming or not.
function sseBody(...dataLines: string[]): string {
  return dataLines.map((d) => `data: ${d}\n\n`).join("");
}

function streamResponse(status: number, body: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    body: stream,
    text: async () => body,
  } as unknown as Response;
}

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const chunk of gen) out += chunk;
  return out;
}

describe("chatCompleteStream", () => {
  it("yields delta text chunks from Z.ai and stops at [DONE]", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse(
          200,
          sseBody(
            JSON.stringify({ choices: [{ delta: { content: "Hallo " } }] }),
            JSON.stringify({ choices: [{ delta: { content: "Welt" } }] }),
            "[DONE]"
          )
        )
      )
    );

    const text = await collectStream(
      chatCompleteStream({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    );
    expect(text).toBe("Hallo Welt");
  });

  it("sends stream: true and thinking disabled in the Z.ai request body", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    let capturedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return streamResponse(200, sseBody("[DONE]"));
      })
    );

    await collectStream(
      chatCompleteStream({ system: "sys", messages: [{ role: "user", content: "hi" }] })
    );
    const body = JSON.parse(capturedBody);
    expect(body.stream).toBe(true);
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  it("throws before streaming when Z.ai responds with a non-2xx status", async () => {
    vi.stubEnv("ZAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse(401, JSON.stringify({ error: { message: "invalid api key" } }))
      )
    );

    await expect(
      collectStream(chatCompleteStream({ system: "sys", messages: [{ role: "user", content: "hi" }] }))
    ).rejects.toThrow("invalid api key");
  });

  it("streams the custom BYOK endpoint the same OpenAI-compatible way", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse(200, sseBody(JSON.stringify({ choices: [{ delta: { content: "ok" } }] }), "[DONE]"))
      )
    );

    const text = await collectStream(
      chatCompleteStream({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "https://example.test/v1/chat/completions",
          model: "some-model",
        },
      })
    );
    expect(text).toBe("ok");
  });

  it("still applies the SSRF guard to the custom endpoint when streaming", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      collectStream(
        chatCompleteStream({
          system: "sys",
          messages: [{ role: "user", content: "hi" }],
          override: {
            provider: "custom",
            apiKey: "user-key",
            baseUrl: "https://sneaky.example/v1/chat/completions",
            model: "some-model",
          },
        })
      )
    ).rejects.toThrow("nicht erlaubt");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("merges the caller's own abort signal into the custom endpoint's fetch call", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedSignal = init.signal as AbortSignal;
        return streamResponse(200, sseBody("[DONE]"));
      })
    );
    const controller = new AbortController();
    controller.abort();

    await collectStream(
      chatCompleteStream({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        signal: controller.signal,
        override: {
          provider: "custom",
          apiKey: "user-key",
          baseUrl: "https://example.test/v1/chat/completions",
          model: "some-model",
        },
      })
    );

    // A merged signal (AbortSignal.any) reports aborted once either source
    // does, confirming the caller's own signal actually made it into the
    // fetch call, not just the fixed timeout.
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("throws once the custom endpoint's streamed response exceeds the size cap", async () => {
    const oversized = new Uint8Array(2_000_001).fill(32);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, statusText: "", body: stream, text: async () => "" }))
    );

    await expect(
      collectStream(
        chatCompleteStream({
          system: "sys",
          messages: [{ role: "user", content: "hi" }],
          override: {
            provider: "custom",
            apiKey: "user-key",
            baseUrl: "https://example.test/v1/chat/completions",
            model: "some-model",
          },
        })
      )
    ).rejects.toThrow("überschreitet das Limit");
  });
});

// QA finding U-4: /api/chat used to embed err.message straight into the
// client-visible detail, leaking raw provider text ("Z.ai 429: Rate limit
// exceeded for model glm-4.5-air"). classifyLlmFailure buckets whatever was
// thrown so the route can map it to German text instead, without the model/
// provider ever reaching the client.
describe("classifyLlmFailure", () => {
  it("buckets an empty reply as 'empty'", () => {
    expect(classifyLlmFailure(new LlmEmptyReplyError("Z.ai"))).toBe("empty");
  });

  it("buckets this file's own '<Provider> 429: ...' shape as rate_limited", () => {
    expect(classifyLlmFailure(new Error("Z.ai 429: Rate limit exceeded for model glm-4.5-air"))).toBe(
      "rate_limited"
    );
  });

  it("buckets 401/403 as auth", () => {
    expect(classifyLlmFailure(new Error("Custom-Provider 401: invalid_api_key"))).toBe("auth");
    expect(classifyLlmFailure(new Error("Custom-Provider 403: forbidden"))).toBe("auth");
  });

  it("buckets a 5xx status as unavailable", () => {
    expect(classifyLlmFailure(new Error("Z.ai 503: upstream overloaded"))).toBe("unavailable");
  });

  it("reads a numeric .status off an SDK-style error object (Anthropic/OpenAI shape)", () => {
    expect(classifyLlmFailure({ status: 429, message: "rate limited" })).toBe("rate_limited");
  });

  it("buckets a timeout message as unavailable", () => {
    expect(classifyLlmFailure(new Error("The operation timed out"))).toBe("unavailable");
  });

  it("falls back to unknown for anything unrecognized, rather than guessing", () => {
    expect(classifyLlmFailure(new Error("something odd happened"))).toBe("unknown");
    expect(classifyLlmFailure("not even an Error")).toBe("unknown");
  });
});

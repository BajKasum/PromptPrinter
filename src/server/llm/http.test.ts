import { describe, expect, it, vi } from "vitest";
import { LlmEmptyReplyError } from "@/server/llm/types";
import { readCompletion, readOpenAiCompatibleSse, throwProviderError } from "./http";

const captureError = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/observability", () => ({ captureError }));

const frame = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;

function streamOf(chunks: string[], onCancel?: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next === undefined) controller.close();
      else controller.enqueue(encoder.encode(next));
    },
    cancel: () => onCancel?.(),
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const text of readOpenAiCompatibleSse(stream)) out.push(text);
  return out;
}

describe("readOpenAiCompatibleSse", () => {
  it.each([
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["CR", "\r"],
  ])("liest %s-Rahmen gleich", async (_name, eol) => {
    const raw = [frame("Hal"), frame("lo"), "data: [DONE]", ""].join(eol + eol);
    expect(await collect(streamOf([raw]))).toEqual(["Hal", "lo"]);
  });

  it("findet einen Rahmen, dessen Trenner über zwei Stücke verteilt ist", async () => {
    expect(await collect(streamOf([`${frame("a")}\r`, `\n\r`, `\n${frame("b")}\r\n\r\n`]))).toEqual(["a", "b"]);
  });

  it("bricht die Quelle ab, wenn [DONE] vor dem Ende des Bodys kommt", async () => {
    const cancel = vi.fn();
    await collect(streamOf([`${frame("a")}\n\ndata: [DONE]\n\n`, "noch mehr"], cancel));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("bricht die Quelle ab, wenn der Verbraucher vorzeitig aussteigt", async () => {
    const cancel = vi.fn();
    const source = streamOf([`${frame("a")}\n\n`, `${frame("b")}\n\n`], cancel);
    for await (const text of readOpenAiCompatibleSse(source)) {
      expect(text).toBe("a");
      break;
    }
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("bricht die Quelle ab, wenn die Grössengrenze überschritten wird", async () => {
    const cancel = vi.fn();
    const source = streamOf(["x".repeat(20), "y".repeat(20)], cancel);
    await expect(readOpenAiCompatibleSse(source, 10).next()).rejects.toThrow("Limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

const failing = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, statusText: "Bad", headers });

describe("throwProviderError", () => {
  it("nimmt die Meldung des Anbieters aus der erwarteten JSON-Form", async () => {
    const err = await throwProviderError("Z.ai", failing(401, JSON.stringify({ error: { message: "invalid key" } }))).catch((e) => e);
    expect(err.message).toBe("Z.ai 401: invalid key");
  });

  it("gibt ohne die erwartete Form NIE den Rohtext weiter, es sei denn rawFallbackChars erlaubt es", async () => {
    const body = "<html>geheimer Proxy-Text</html>";
    const strict = await throwProviderError("Custom-Provider", failing(502, body)).catch((e) => e);
    expect(strict.message).toBe("Custom-Provider 502: Bad");
    expect(strict.message).not.toContain("geheimer");

    const lenient = await throwProviderError("Z.ai", failing(502, body), { rawFallbackChars: 10 }).catch((e) => e);
    expect(lenient.message).toBe("Z.ai 502: <html>gehe");
  });

  it("die Meldung des Anbieters gewinnt auch gegen den Rohtext-Rückfall", async () => {
    const err = await throwProviderError("Z.ai", failing(429, JSON.stringify({ error: { message: "slow down" } })), {
      rawFallbackChars: 300,
    }).catch((e) => e);
    expect(err.message).toBe("Z.ai 429: slow down");
  });

  it("trägt die Wartezeit aus Retry-After", async () => {
    const err = await throwProviderError("Z.ai", failing(429, "{}", { "retry-after": "7" })).catch((e) => e);
    expect(err.retryAfterMs).toBe(7000);
  });

  it("meldet nur auf Wunsch eine Antwort ohne lesbare Meldung, mit Status und Länge, nie mit Inhalt", async () => {
    captureError.mockClear();
    await throwProviderError("Custom-Provider", failing(500, "geheim"), { reportUnparsable: true }).catch(() => {});
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError.mock.calls[0][2]).toEqual({ status: 500, bodyChars: 6 });

    captureError.mockClear();
    await throwProviderError("Custom-Provider", failing(500, "geheim")).catch(() => {});
    await throwProviderError("Custom-Provider", failing(500, JSON.stringify({ error: { message: "x" } })), {
      reportUnparsable: true,
    }).catch(() => {});
    expect(captureError).not.toHaveBeenCalled();
  });
});

describe("readCompletion", () => {
  it("nimmt content, getrimmt, und den Verbrauch, wenn beide Zahlen da sind", () => {
    expect(
      readCompletion(
        { choices: [{ message: { content: " Hallo " } }], usage: { prompt_tokens: 3, completion_tokens: 5 } },
        "Z.ai"
      )
    ).toEqual({ text: "Hallo", usage: { inputTokens: 3, outputTokens: 5 } });
  });

  it("reasoning_content springt nur ein, wenn content leer ist", () => {
    expect(readCompletion({ choices: [{ message: { content: "  ", reasoning_content: "Denken" } }] }, "x").text).toBe("Denken");
    expect(readCompletion({ choices: [{ message: { content: "Antwort", reasoning_content: "Denken" } }] }, "x").text).toBe("Antwort");
  });

  it("Verbrauch ist null, sobald eine der beiden Zahlen fehlt oder keine Zahl ist", () => {
    const message = { choices: [{ message: { content: "ok" } }] };
    expect(readCompletion({ ...message, usage: { prompt_tokens: 3 } }, "x").usage).toBeNull();
    expect(readCompletion({ ...message, usage: { prompt_tokens: "3", completion_tokens: 5 } as never }, "x").usage).toBeNull();
    expect(readCompletion(message, "x").usage).toBeNull();
  });

  it("eine Antwort ohne Text ist ein LlmEmptyReplyError mit dem Namen des Anbieters", () => {
    expect(() => readCompletion({ choices: [{ message: {} }] }, "Custom-Provider")).toThrow(LlmEmptyReplyError);
    expect(() => readCompletion({}, "Custom-Provider")).toThrow("Custom-Provider returned an empty reply");
  });
});

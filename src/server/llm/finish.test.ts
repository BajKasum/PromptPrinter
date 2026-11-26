import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeComplete,
  chatComplete,
  chatCompleteStream,
  classifyLlmFailure,
  type LlmOverride,
} from "@/server/llm";
import { __resetServerBreakerForTests } from "@/server/llm-failover";
import { anthropicFinish, cutOffByReason, geminiFinish, openAiFinish } from "@/server/llm/finish";
import { LlmBlockedError, LlmReportedError } from "@/server/llm/types";

// Warum eine Antwort endet (#403): Jeder Weg liest den Abschlussgrund. Abgeschnitten meldet onTruncated, ein
// Inhaltsfilter oder gemeldeter Fehler wirft wie jeder Fehler. Die drei SDKs laufen echt, nur fetch ist ersetzt.

vi.mock("node:dns", () => ({
  promises: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
}));

const message = [{ role: "user" as const, content: "hi" }];

// ─── Die Leitungen der Anbieter ──────────────────────────────────────────────

const sse = (data: unknown) => `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
const openAiText = (text: string, finish: string | null = null) =>
  sse({ choices: [{ index: 0, delta: { content: text }, finish_reason: finish }] });
const openAiEnd = (finish: string) => sse({ choices: [{ index: 0, delta: {}, finish_reason: finish }] });
const DONE = sse("[DONE]");

const event = (type: string, data: object = {}) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const anthropicStart = [
  event("message_start", {
    message: { id: "m", type: "message", role: "assistant", model: "m", content: [], usage: { input_tokens: 1, output_tokens: 1 } },
  }),
  event("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
];
const anthropicText = (text: string) => event("content_block_delta", { index: 0, delta: { type: "text_delta", text } });
const anthropicEnd = (stopReason: string) => [
  event("content_block_stop", { index: 0 }),
  event("message_delta", { delta: { stop_reason: stopReason }, usage: { output_tokens: 2 } }),
  event("message_stop"),
];

const geminiText = (text: string, finishReason?: string) =>
  sse({ candidates: [{ content: { role: "model", parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });

/** Ein Strom mit „Hal“ und „lo“, danach dem Ende `reason`; ohne Angabe schliesst die Verbindung ohne Abschluss. */
type Wire = (reason?: string) => string[];
const openAiWire: Wire = (reason) => [openAiText("Hal"), openAiText("lo"), ...(reason ? [openAiEnd(reason), DONE] : [])];
const anthropicWire: Wire = (reason) => [
  ...anthropicStart,
  anthropicText("Hal"),
  anthropicText("lo"),
  ...(reason ? anthropicEnd(reason) : []),
];
const geminiWire: Wire = (reason) => [geminiText("Hal"), geminiText("lo", reason)];

/** Jede Anfrage bekommt eine frische Antwort mit diesen Zeilen. */
function answer(lines: string[]) {
  const fetchMock = vi.fn(
    async (_url: unknown, _init?: RequestInit) =>
      new Response(lines.join(""), { status: 200, headers: { "content-type": "text/event-stream" } })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ─── Die Wege ────────────────────────────────────────────────────────────────

const custom = (baseUrl = "https://example.test/v1/chat/completions"): LlmOverride => ({
  provider: "custom",
  apiKey: "k",
  baseUrl,
  model: "some-model",
});

type Path = { override?: LlmOverride; env?: Record<string, string> };
const zai: Path = {};
const serverGemini: Path = { env: { ZAI_API_KEY: "", GEMINI_API_KEY: "gemini-key" } };

/** Führt einen Zug aus und sagt, was ankam, ob er „abgeschnitten“ meldete und woran er scheiterte. */
async function run(path: Path) {
  for (const [name, value] of Object.entries(path.env ?? {})) vi.stubEnv(name, value);
  const onTruncated = vi.fn();
  let text = "";
  let error: unknown;
  const result = (async () => {
    try {
      for await (const chunk of chatCompleteStream({
        system: "s",
        messages: message,
        override: path.override,
        onTruncated,
      })) {
        text += chunk;
      }
    } catch (err) {
      error = err;
    }
  })();
  await vi.runAllTimersAsync();
  await result;
  return { text, truncated: onTruncated.mock.calls.length, error };
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetServerBreakerForTests();
  vi.stubEnv("ZAI_API_KEY", "zai-key");
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each([
  ["Z.ai", zai, openAiWire, "stop", "length", "sensitive"],
  ["Custom-Slot", { override: custom() }, openAiWire, "stop", "length", "content_filter"],
  ["OpenAI mit eigenem Key", { override: { provider: "openai", apiKey: "k" } }, openAiWire, "stop", "length", "content_filter"],
  ["Anthropic mit eigenem Key", { override: { provider: "anthropic", apiKey: "k" } }, anthropicWire, "end_turn", "max_tokens", "refusal"],
  ["Gemini als Server-Anbieter", serverGemini, geminiWire, "STOP", "MAX_TOKENS", "SAFETY"],
  ["Gemini mit eigenem Key", { override: { provider: "gemini", apiKey: "k" } }, geminiWire, "STOP", "MAX_TOKENS", "PROHIBITED_CONTENT"],
] as [string, Path, Wire, string, string, string][])("%s", (_name, path, wire, complete, limit, filter) => {
  it("fertig: der Text kommt an, ohne Meldung", async () => {
    answer(wire(complete));
    expect(await run(path)).toEqual({ text: "Hallo", truncated: 0, error: undefined });
  });

  it("an der Ausgabegrenze: der Text bleibt, onTruncated meldet es einmal", async () => {
    answer(wire(limit));
    expect(await run(path)).toEqual({ text: "Hallo", truncated: 1, error: undefined });
  });

  it("die Verbindung schliesst ohne Abschluss: nicht zu Ende", async () => {
    answer(wire(undefined));
    expect(await run(path)).toEqual({ text: "Hallo", truncated: 1, error: undefined });
  });

  it("vom Inhaltsfilter gestoppt: ein Fehler wie jeder andere, ohne neuen Versuch", async () => {
    const fetchMock = answer(wire(filter));
    const result = await run(path);
    expect(result.error).toBeInstanceOf(LlmBlockedError);
    expect(classifyLlmFailure(result.error)).toBe("empty");
    expect(result.truncated).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Fehlerrahmen mitten im Strom", () => {
  it.each([
    ["Gateway mit error-Objekt", custom(), [openAiText("Hal"), sse({ error: { code: 502, message: "upstream down" } }), DONE]],
    ["Z.ai mit Fehlercode", undefined, [openAiText("Hal"), sse({ error: { code: "1305", message: "busy" } }), DONE]],
    ["OpenRouter mit finish_reason error", custom(), [openAiText("Hal"), sse({ error: { message: "x" }, choices: [{ delta: {}, finish_reason: "error" }] })]],
    ["error als Text", custom(), [openAiText("Hal"), sse({ error: "out of memory" }), DONE]],
    ["object: error", custom(), [openAiText("Hal"), sse({ object: "error", message: "too long", code: 400 }), DONE]],
    ["event: error ohne error-Feld", custom(), [openAiText("Hal"), `event: error\n${sse({ message: "gone" })}`, DONE]],
    ["event: error ohne JSON", custom(), [openAiText("Hal"), `event: error\ndata: Internal\n\n`, DONE]],
    ["OpenAI-SDK", { provider: "openai", apiKey: "k" } as LlmOverride, [openAiText("Hal"), sse({ error: { message: "x" } })]],
    ["Anthropic-SDK", { provider: "anthropic", apiKey: "k" } as LlmOverride, [...anthropicStart, anthropicText("Hal"), event("error", { error: { type: "overloaded_error", message: "Overloaded" } })]],
    ["Gemini-SDK", { provider: "gemini", apiKey: "k" } as LlmOverride, [geminiText("Hal"), sse({ error: { code: 503, message: "x", status: "UNAVAILABLE" } })]],
  ])("%s wird ein Fehler, der Teiltext wird nicht neu angefangen", async (_name, override, lines) => {
    const fetchMock = answer(lines);
    const result = await run({ override });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.text).toBe("Hal");
    expect(result.truncated).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("nennt nur die geparste Meldung, gekürzt, und den Status, wenn es einer ist", async () => {
    answer([sse({ error: { code: "404", message: "y".repeat(1000) } })]);
    const { error } = await run({ override: custom() });
    expect(error).toBeInstanceOf(LlmReportedError);
    expect((error as LlmReportedError).status).toBe(404);
    expect((error as Error).message).toBe(`Custom-Provider reported an error: ${"y".repeat(300)}`);

    answer([`event: error\ndata: <html>geheim</html>\n\n`]);
    const raw = await run({ override: custom() });
    expect((raw.error as Error).message).not.toContain("geheim");
  });

  it("ein Fehlercode des Anbieters ist kein HTTP-Status", async () => {
    answer([sse({ error: { code: "1305", message: "busy" } })]);
    const { error } = await run(zai);
    expect((error as LlmReportedError).status).toBeUndefined();
  });

  it("vor dem ersten Wort wird ein Fehler mit vorübergehendem Status wiederholt", async () => {
    const fetchMock = answer([sse({ error: { code: 502, message: "upstream down" } })]);
    const { error } = await run({ override: custom() });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(classifyLlmFailure(error)).toBe("unavailable");
  });

  it("network_error von Z.ai vor dem ersten Wort ist ein Ausfall: wiederholt, dann Gemini", async () => {
    const gemini = geminiWire("STOP").join("");
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes("api.z.ai")
        ? new Response(openAiEnd("network_error") + DONE)
        : new Response(gemini, { headers: { "content-type": "text/event-stream" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await run({ env: { GEMINI_API_KEY: "gemini-key" } });

    expect(result).toEqual({ text: "Hallo", truncated: 0, error: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("OpenAI-Form: wann eine Antwort ohne Abschlussgrund fertig ist", () => {
  it("fremder Endpunkt, [DONE] ohne finish_reason: fertig (manche Server nennen keinen)", async () => {
    answer([openAiText("Hallo"), DONE]);
    expect(await run({ override: custom() })).toEqual({ text: "Hallo", truncated: 0, error: undefined });
  });

  it("Z.ai, [DONE] ohne finish_reason: nicht zu Ende, auch über den Custom-Slot auf api.z.ai", async () => {
    answer([openAiText("Hallo"), DONE]);
    expect((await run(zai)).truncated).toBe(1);
    answer([openAiText("Hallo"), DONE]);
    expect((await run({ override: custom("https://api.z.ai/api/paas/v4/chat/completions") })).truncated).toBe(1);
  });

  it("finish_reason ohne [DONE]: fertig", async () => {
    answer([openAiText("Hallo", "stop")]);
    expect((await run({ override: custom() })).truncated).toBe(0);
  });

  it("ein leerer finish_reason ist keiner", async () => {
    answer([sse({ choices: [{ delta: { content: "Hallo" }, finish_reason: "" }] })]);
    expect((await run({ override: custom() })).truncated).toBe(1);
  });

  it("ein finish_reason, der kein Text ist, zählt wie keiner und bricht nichts", async () => {
    answer([sse({ choices: [{ delta: { content: "Hallo" }, finish_reason: 1 }] }), DONE]);
    expect(await run({ override: custom() })).toEqual({ text: "Hallo", truncated: 0, error: undefined });
  });

  it("eigene Namen für das normale Ende zählen als fertig", async () => {
    answer([openAiText("Hallo", "eos"), DONE]);
    expect(await run(zai)).toEqual({ text: "Hallo", truncated: 0, error: undefined });
  });

  it("eine spätere Zeile mit Verbrauch ohne choices ändert nichts", async () => {
    answer([openAiText("Hallo", "length"), sse({ choices: [], usage: { prompt_tokens: 1 } }), DONE]);
    expect(await run(zai)).toEqual({ text: "Hallo", truncated: 1, error: undefined });
  });

  it("der eigene Endpunkt des Betreibers wertet genauso aus", async () => {
    answer([openAiText("Hallo", "length"), DONE]);
    const result = await run({ env: { ZAI_API_KEY: "", LLM_BASE_URL: "https://example.test/v1", LLM_MODEL: "m" } });
    expect(result).toEqual({ text: "Hallo", truncated: 1, error: undefined });
  });
});

describe("Gemini lehnt die Anfrage ab (promptFeedback)", () => {
  it("im Strom: ein Fehler des Inhaltsfilters statt einer leeren Antwort", async () => {
    answer([sse({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } })]);
    const { error } = await run({ override: { provider: "gemini", apiKey: "k" } });
    expect(error).toBeInstanceOf(LlmBlockedError);
  });
});

describe("nicht gestreamte Aufrufe (Schlüsseltest, Projekt-Analyse)", () => {
  const json = (body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
  const anthropic = { type: "message", role: "assistant", id: "m", model: "m", usage: { input_tokens: 1, output_tokens: 1 } };

  it.each([
    ["OpenAI", { provider: "openai", apiKey: "k" }, { choices: [{ message: { content: "Halb" }, finish_reason: "content_filter" }] }],
    ["Anthropic", { provider: "anthropic", apiKey: "k" }, { ...anthropic, content: [{ type: "text", text: "Halb" }], stop_reason: "refusal" }],
    ["Gemini", { provider: "gemini", apiKey: "k" }, { candidates: [{ content: { parts: [{ text: "Halb" }] }, finishReason: "SAFETY" }] }],
    ["Custom-Slot", custom(), { choices: [{ message: { content: "Halb" }, finish_reason: "content_filter" }] }],
  ] as [string, LlmOverride, object][])("%s: ein gefilterter Text wird nicht als Ergebnis genommen", async (_name, override, body) => {
    for (const call of [
      () => chatComplete({ system: "s", messages: message, override }),
      () => analyzeComplete({ system: "s", text: "t", override }),
    ]) {
      json(body);
      await expect(call()).rejects.toBeInstanceOf(LlmBlockedError);
    }
  });

  it.each([
    ["OpenAI", { provider: "openai", apiKey: "k" }, { choices: [{ message: { content: "Halb" }, finish_reason: "length" }] }],
    ["Anthropic", { provider: "anthropic", apiKey: "k" }, { ...anthropic, content: [{ type: "text", text: "Halb" }], stop_reason: "max_tokens" }],
    ["Gemini", { provider: "gemini", apiKey: "k" }, { candidates: [{ content: { parts: [{ text: "Halb" }] }, finishReason: "MAX_TOKENS" }] }],
    ["Custom-Slot", custom(), { choices: [{ message: { content: "Halb" }, finish_reason: "length" }] }],
  ] as [string, LlmOverride, object][])("%s: eine abgeschnittene Antwort bleibt", async (_name, override, body) => {
    json(body);
    await expect(analyzeComplete({ system: "s", text: "t", override })).resolves.toMatchObject({ text: "Halb" });
  });

  it("ein Fehler in einer 200-Antwort wirft mit der Meldung des Anbieters, ein 503 wird wiederholt", async () => {
    json({ error: { message: "model overloaded", code: 503 } });
    const call = analyzeComplete({ system: "s", text: "t", override: custom() }).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(String(await call)).toContain("model overloaded");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("die Zuordnung", () => {
  it("OpenAI-Form", () => {
    for (const reason of ["length", "max_tokens", "model_length", "model_context_window_exceeded", "LENGTH"]) {
      expect(openAiFinish(reason), reason).toBe("truncated");
    }
    for (const reason of ["content_filter", "sensitive"]) expect(openAiFinish(reason), reason).toBe("blocked");
    for (const reason of ["error", "network_error", "insufficient_system_resource"]) {
      expect(openAiFinish(reason), reason).toBe("failed");
    }
    for (const reason of ["stop", "tool_calls", "function_call", "eos", "constructor"]) {
      expect(openAiFinish(reason), reason).toBe("complete");
    }
  });

  it("Anthropic und Gemini", () => {
    expect(anthropicFinish("model_context_window_exceeded")).toBe("truncated");
    for (const reason of ["end_turn", "stop_sequence", "tool_use", "pause_turn"]) {
      expect(anthropicFinish(reason), reason).toBe("complete");
    }
    for (const reason of ["RECITATION", "BLOCKLIST", "SPII", "IMAGE_SAFETY", "MODEL_ARMOR", "LANGUAGE"]) {
      expect(geminiFinish(reason), reason).toBe("blocked");
    }
    for (const reason of ["OTHER", "MALFORMED_RESPONSE", "NEU_ERFUNDEN"]) {
      expect(geminiFinish(reason), reason).toBe("truncated");
    }
  });

  it("ein Abbruch beim Anbieter gilt als Ausfall (503), ein blosses error nicht", () => {
    const status = (reason: string) => {
      try {
        return cutOffByReason("failed", "Z.ai", reason);
      } catch (err) {
        return (err as LlmReportedError).status;
      }
    };
    expect(status("network_error")).toBe(503);
    expect(status("insufficient_system_resource")).toBe(503);
    expect(status("error")).toBeUndefined();
  });
});

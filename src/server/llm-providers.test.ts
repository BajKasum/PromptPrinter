import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as llm from "@/server/llm";
import {
  analyzeComplete,
  chatComplete,
  chatCompleteStream,
  classifyLlmFailure,
  LlmEmptyReplyError,
  type AnalysisImage,
  type LlmMessage,
} from "@/server/llm";

// Charakterisierungstests (Betriebs-Audit M7, Teil 2): halten die Anfrageform jedes
// Anbieters fest, BEVOR llm.ts in ein Verzeichnis zerlegt wird. Sie rufen nur die
// öffentliche Fläche von "@/server/llm" und ersetzen die drei SDKs sowie fetch, so
// dass sie vor und nach dem Schnitt dasselbe prüfen: Modell, Systemprompt, Bilder,
// Token-Grenze, Abbruch-Signal, Wiederholungs-Einstellung der SDKs, Textgewinnung,
// Verbrauchsangaben und die Fehlerklassen.
//
// Was hier bewusst "komisch" aussieht, ist festgehalten, nicht gutgeheißen: die
// Reihenfolge von Text und Bild unterscheidet sich zwischen Chat und Analyse
// (Anthropic), und die Analyse schickt `thinking: disabled` auch an den Custom-Slot.
// Ein Schnitt darf daran nichts ändern.

const sdk = vi.hoisted(() => ({
  anthropicCtor: vi.fn(),
  anthropicCreate: vi.fn(),
  openaiCtor: vi.fn(),
  openaiCreate: vi.fn(),
  geminiCtor: vi.fn(),
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    constructor(options: unknown) {
      sdk.anthropicCtor(options);
    }
    messages = { create: (...args: unknown[]) => sdk.anthropicCreate(...args) };
  },
}));
vi.mock("openai", () => ({
  default: class {
    constructor(options: unknown) {
      sdk.openaiCtor(options);
    }
    chat = { completions: { create: (...args: unknown[]) => sdk.openaiCreate(...args) } };
  },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      sdk.geminiCtor(options);
    }
    models = {
      generateContent: (...args: unknown[]) => sdk.generateContent(...args),
      generateContentStream: (...args: unknown[]) => sdk.generateContentStream(...args),
    };
  },
}));

// Der Custom-Slot prüft seine Adresse gegen SSRF (DNS-Auflösung): hier eine öffentliche.
vi.mock("node:dns", () => ({
  promises: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
}));

beforeEach(() => {
  for (const mock of Object.values(sdk)) mock.mockReset();
  vi.stubEnv("ZAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ZAI_MODEL", undefined);
  vi.stubEnv("GEMINI_MODEL", undefined);
  vi.stubEnv("ZAI_VISION_MODEL", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const IMG: AnalysisImage = { mediaType: "image/png", base64: "QUJD" };
const IMG_URL = "data:image/png;base64,QUJD";
const history: LlmMessage[] = [
  { role: "user", content: "hallo" },
  { role: "assistant", content: "hi" },
  { role: "user", content: "schau", images: [IMG] },
];

async function* events<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}
async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of gen) out.push(chunk);
  return out;
}
const sdkError = (status: number, message = "sdk error") => Object.assign(new Error(message), { status });

// ─── Öffentliche Fläche ──────────────────────────────────────────────────────

describe('öffentliche Fläche von "@/server/llm"', () => {
  it("exportiert genau diese Werte (Typen prüft der Compiler über die Aufrufer)", () => {
    // Ein Schnitt in mehrere Dateien darf nichts hinzufügen oder verlieren: die
    // Aufrufer (Chat-Route, Einstellungen, Projekt-Gedächtnis, Tests) hängen an
    // genau dieser Liste.
    expect(Object.keys(llm).sort()).toEqual([
      "LlmEmptyReplyError",
      "ZAI_FIRST_CHUNK_TIMEOUT_MS",
      "analyzeComplete",
      "chatComplete",
      "chatCompleteStream",
      "classifyLlmFailure",
      "llmConfig",
      "toAnthropicMessages",
      "toGeminiContents",
      "toOpenAiSdkMessages",
      "zaiModelFor",
    ]);
  });
});

// ─── Anthropic (nur BYOK) ───────────────────────────────────────────────────

describe("Anthropic (BYOK)", () => {
  const override = { provider: "anthropic" as const, apiKey: "ak-test" };

  it("chatComplete: Anfrageform, Systemprompt als Cache-Block, Bilder vor dem Text, Token-Grenze", async () => {
    sdk.anthropicCreate.mockResolvedValue({
      content: [
        { type: "text", text: " Hallo " },
        { type: "tool_use", id: "x" },
        { type: "text", text: "Welt " },
      ],
      usage: { input_tokens: 11, output_tokens: 7 },
    });

    const result = await chatComplete({ system: "SYS", messages: history, override });

    expect(sdk.anthropicCtor).toHaveBeenCalledWith({ apiKey: "ak-test", maxRetries: 0 });
    expect(sdk.anthropicCreate).toHaveBeenCalledTimes(1);
    // Genau EIN Argument: ohne Abbruch-Signal im Einzelaufruf.
    expect(sdk.anthropicCreate.mock.calls[0]).toEqual([
      {
        model: "claude-sonnet-5",
        system: [{ type: "text", text: "SYS", cache_control: { type: "ephemeral" } }],
        max_tokens: 6144,
        messages: [
          { role: "user", content: "hallo" },
          { role: "assistant", content: "hi" },
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
              { type: "text", text: "schau" },
            ],
          },
        ],
      },
    ]);
    // Nur Textblöcke, zusammengesetzt und getrimmt; Verbrauch umbenannt.
    expect(result).toEqual({ text: "Hallo Welt", usage: { inputTokens: 11, outputTokens: 7 } });
  });

  it("chatComplete: eigene Token-Grenze wird durchgereicht, fehlender Verbrauch ist null", async () => {
    sdk.anthropicCreate.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const result = await chatComplete({ system: "S", messages: [{ role: "user", content: "x" }], maxOutputTokens: 321, override });
    expect(sdk.anthropicCreate.mock.calls[0][0].max_tokens).toBe(321);
    expect(result.usage).toBeNull();
  });

  it("chatComplete: eine Antwort ohne Text ist LlmEmptyReplyError und wird nicht wiederholt", async () => {
    sdk.anthropicCreate.mockResolvedValue({ content: [{ type: "tool_use", id: "x" }] });
    const error = await chatComplete({ system: "S", messages: history, override }).catch((e) => e);
    expect(error).toBeInstanceOf(LlmEmptyReplyError);
    expect(error.message).toBe("Anthropic returned an empty reply");
    expect(classifyLlmFailure(error)).toBe("empty");
    expect(sdk.anthropicCreate).toHaveBeenCalledTimes(1);
  });

  it("chatCompleteStream: stream: true, Signal als zweites Argument, nur text_delta kommt durch", async () => {
    const controller = new AbortController();
    sdk.anthropicCreate.mockResolvedValue(
      events([
        { type: "message_start" },
        { type: "content_block_delta", delta: { type: "text_delta", text: "A" } },
        { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "B" } },
        { type: "message_stop" },
      ])
    );

    const chunks = await collect(
      chatCompleteStream({ system: "SYS", messages: history, override, signal: controller.signal })
    );

    expect(chunks).toEqual(["A", "B"]);
    const [body, options] = sdk.anthropicCreate.mock.calls[0];
    expect(body).toMatchObject({ model: "claude-sonnet-5", max_tokens: 6144, stream: true });
    expect(body.system).toEqual([{ type: "text", text: "SYS", cache_control: { type: "ephemeral" } }]);
    expect(options.signal).toBe(controller.signal);
    expect(sdk.anthropicCtor).toHaveBeenCalledWith({ apiKey: "ak-test", maxRetries: 0 });
  });

  it("chatCompleteStream ohne Signal reicht trotzdem ein Optionsobjekt durch", async () => {
    sdk.anthropicCreate.mockResolvedValue(events([]));
    await collect(chatCompleteStream({ system: "S", messages: history, override }));
    expect(sdk.anthropicCreate.mock.calls[0][1]).toEqual({ signal: undefined });
  });

  it("analyzeComplete: Text vor den Bildern, 1500 Token, Signal, Modell im Ergebnis", async () => {
    const controller = new AbortController();
    sdk.anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: " Fakten " }],
      usage: { input_tokens: 3, output_tokens: 2 },
    });

    const result = await analyzeComplete({
      system: "SYS",
      text: "Quelle",
      images: [IMG],
      override,
      signal: controller.signal,
    });

    const [body, options] = sdk.anthropicCreate.mock.calls[0];
    expect(body).toEqual({
      model: "claude-sonnet-5",
      system: [{ type: "text", text: "SYS", cache_control: { type: "ephemeral" } }],
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Quelle" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
          ],
        },
      ],
    });
    expect(options.signal).toBe(controller.signal);
    expect(result).toEqual({ text: "Fakten", usage: { inputTokens: 3, outputTokens: 2 }, model: "claude-sonnet-5" });
  });

  it("Fehlerklassen: ein abgelehnter Key kommt sofort und unverändert an, ohne Wiederholung", async () => {
    sdk.anthropicCreate.mockRejectedValue(sdkError(401, "invalid x-api-key"));
    const error = await chatComplete({ system: "S", messages: history, override }).catch((e) => e);
    expect(error.status).toBe(401);
    expect(classifyLlmFailure(error)).toBe("auth");
    expect(sdk.anthropicCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── OpenAI (nur BYOK) ──────────────────────────────────────────────────────

describe("OpenAI (BYOK)", () => {
  const override = { provider: "openai" as const, apiKey: "ok-test" };

  it("chatComplete: Systemprompt zuerst, Bilder nach dem Text, max_completion_tokens", async () => {
    sdk.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: " Antwort " } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    });

    const result = await chatComplete({ system: "SYS", messages: history, override });

    expect(sdk.openaiCtor).toHaveBeenCalledWith({ apiKey: "ok-test", maxRetries: 0 });
    expect(sdk.openaiCreate.mock.calls[0]).toEqual([
      {
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "SYS" },
          { role: "user", content: "hallo" },
          { role: "assistant", content: "hi" },
          {
            role: "user",
            content: [
              { type: "text", text: "schau" },
              { type: "image_url", image_url: { url: IMG_URL } },
            ],
          },
        ],
        max_completion_tokens: 6144,
      },
    ]);
    expect(result).toEqual({ text: "Antwort", usage: { inputTokens: 5, outputTokens: 3 } });
  });

  it("chatComplete: leere Antwort ist LlmEmptyReplyError, fehlender Verbrauch null", async () => {
    sdk.openaiCreate.mockResolvedValue({ choices: [{ message: { content: "   " } }] });
    const error = await chatComplete({ system: "S", messages: history, override }).catch((e) => e);
    expect(error).toBeInstanceOf(LlmEmptyReplyError);
    expect(error.message).toBe("OpenAI returned an empty reply");

    sdk.openaiCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    expect((await chatComplete({ system: "S", messages: history, override })).usage).toBeNull();
  });

  it("chatCompleteStream: stream: true, Signal, leere Deltas werden übersprungen", async () => {
    const controller = new AbortController();
    sdk.openaiCreate.mockResolvedValue(
      events([
        { choices: [{ delta: { role: "assistant" } }] },
        { choices: [{ delta: { content: "X" } }] },
        { choices: [] },
        { choices: [{ delta: { content: "Y" } }] },
      ])
    );

    const chunks = await collect(
      chatCompleteStream({ system: "SYS", messages: history, override, signal: controller.signal })
    );

    expect(chunks).toEqual(["X", "Y"]);
    const [body, options] = sdk.openaiCreate.mock.calls[0];
    expect(body).toMatchObject({ model: "gpt-5.1", max_completion_tokens: 6144, stream: true });
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(options.signal).toBe(controller.signal);
  });

  it("analyzeComplete: ohne Bilder bleibt der Text ein String, mit Bildern wird er zu Teilen", async () => {
    sdk.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "Fakten" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    });

    const plain = await analyzeComplete({ system: "SYS", text: "Quelle", override });
    expect(sdk.openaiCreate.mock.calls[0]).toEqual([
      {
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "SYS" },
          { role: "user", content: "Quelle" },
        ],
        max_completion_tokens: 1500,
      },
      { signal: undefined },
    ]);
    expect(plain).toEqual({ text: "Fakten", usage: { inputTokens: 1, outputTokens: 2 }, model: "gpt-5.1" });

    await analyzeComplete({ system: "SYS", text: "Quelle", images: [IMG], override });
    expect(sdk.openaiCreate.mock.calls[1][0].messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Quelle" },
        { type: "image_url", image_url: { url: IMG_URL } },
      ],
    });
  });

  it("Fehlerklassen: 400 ist unbekannt und wird nicht wiederholt, ein leerer Text ist 'empty'", async () => {
    sdk.openaiCreate.mockRejectedValue(sdkError(400, "bad request"));
    const error = await chatComplete({ system: "S", messages: history, override }).catch((e) => e);
    expect(classifyLlmFailure(error)).toBe("unknown");
    expect(sdk.openaiCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── Gemini (Server-Zweitanbieter und BYOK) ─────────────────────────────────

describe("Gemini", () => {
  const override = { provider: "gemini" as const, apiKey: "gk-test" };
  const GEMINI_RETRY_OFF = { httpOptions: { retryOptions: { attempts: 1 } } };

  it("BYOK chatComplete: Rollen model/user, Bilder als inlineData, Systemanweisung, Token-Grenze", async () => {
    sdk.generateContent.mockResolvedValue({
      text: " Hallo ",
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
    });

    const result = await chatComplete({ system: "SYS", messages: history, override });

    expect(sdk.geminiCtor).toHaveBeenCalledWith({ apiKey: "gk-test", ...GEMINI_RETRY_OFF });
    expect(sdk.generateContent.mock.calls[0]).toEqual([
      {
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: "hallo" }] },
          { role: "model", parts: [{ text: "hi" }] },
          { role: "user", parts: [{ text: "schau" }, { inlineData: { mimeType: "image/png", data: "QUJD" } }] },
        ],
        config: { systemInstruction: "SYS", maxOutputTokens: 6144 },
      },
    ]);
    expect(result).toEqual({ text: "Hallo", usage: { inputTokens: 4, outputTokens: 2 } });
  });

  it("BYOK chatComplete: blockierte Antwort (kein Text) ist LlmEmptyReplyError, unvollständiger Verbrauch null", async () => {
    sdk.generateContent.mockResolvedValue({ text: undefined });
    const error = await chatComplete({ system: "S", messages: history, override }).catch((e) => e);
    expect(error).toBeInstanceOf(LlmEmptyReplyError);
    expect(error.message).toBe("Gemini returned an empty reply");

    sdk.generateContent.mockResolvedValue({ text: "ok", usageMetadata: { promptTokenCount: 4 } });
    expect((await chatComplete({ system: "S", messages: history, override })).usage).toBeNull();
  });

  it("BYOK chatCompleteStream: das Signal geht als abortSignal in die Konfiguration, leere Teile entfallen", async () => {
    const controller = new AbortController();
    sdk.generateContentStream.mockResolvedValue(events([{ text: "A" }, { text: undefined }, { text: "B" }]));

    const chunks = await collect(
      chatCompleteStream({ system: "SYS", messages: history, override, signal: controller.signal })
    );

    expect(chunks).toEqual(["A", "B"]);
    const [body] = sdk.generateContentStream.mock.calls[0];
    expect(body.model).toBe("gemini-3.5-flash");
    expect(body.config).toEqual({ systemInstruction: "SYS", maxOutputTokens: 6144, abortSignal: controller.signal });
  });

  it("als Server-Anbieter (nur GEMINI_API_KEY): Modell aus GEMINI_MODEL, Schlüssel aus der Umgebung", async () => {
    vi.stubEnv("GEMINI_API_KEY", "env-gem");
    vi.stubEnv("GEMINI_MODEL", "gemini-test-model");
    sdk.generateContent.mockResolvedValue({ text: "ok" });

    await chatComplete({ system: "S", messages: [{ role: "user", content: "x" }] });

    expect(sdk.geminiCtor).toHaveBeenCalledWith({ apiKey: "env-gem", ...GEMINI_RETRY_OFF });
    expect(sdk.generateContent.mock.calls[0][0].model).toBe("gemini-test-model");
  });

  it("als Server-Anbieter im Stream und in der Analyse: der Schlüssel geht ohne Leerraum an den SDK", async () => {
    vi.stubEnv("GEMINI_API_KEY", "\tenv-gem \n");
    sdk.generateContentStream.mockResolvedValue(events([{ text: "A" }]));
    sdk.generateContent.mockResolvedValue({ text: "Fakten" });

    await collect(chatCompleteStream({ system: "S", messages: [{ role: "user", content: "x" }] }));
    await analyzeComplete({ system: "S", text: "T" });

    expect(sdk.geminiCtor).toHaveBeenCalledTimes(2);
    for (const call of sdk.geminiCtor.mock.calls) {
      expect(call[0]).toEqual({ apiKey: "env-gem", ...GEMINI_RETRY_OFF });
    }
  });

  it("als Server-Anbieter: leer gesetztes GEMINI_MODEL ergibt das Standardmodell, der Schlüssel geht ohne Leerraum an den SDK", async () => {
    vi.stubEnv("GEMINI_API_KEY", " env-gem\n");
    vi.stubEnv("GEMINI_MODEL", "");
    sdk.generateContent.mockResolvedValue({ text: "ok" });

    await chatComplete({ system: "S", messages: [{ role: "user", content: "x" }] });

    expect(sdk.geminiCtor).toHaveBeenCalledWith({ apiKey: "env-gem", ...GEMINI_RETRY_OFF });
    expect(sdk.generateContent.mock.calls[0][0].model).toBe("gemini-3.5-flash");
  });

  it("analyzeComplete: Text und Bilder in EINER Nutzer-Nachricht, 1500 Token, Signal, Modell im Ergebnis", async () => {
    const controller = new AbortController();
    sdk.generateContent.mockResolvedValue({
      text: " Fakten ",
      usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 4 },
    });

    const result = await analyzeComplete({
      system: "SYS",
      text: "Quelle",
      images: [IMG],
      override,
      signal: controller.signal,
    });

    expect(sdk.generateContent.mock.calls[0]).toEqual([
      {
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: "Quelle" }, { inlineData: { mimeType: "image/png", data: "QUJD" } }] },
        ],
        config: { systemInstruction: "SYS", maxOutputTokens: 1500, abortSignal: controller.signal },
      },
    ]);
    expect(result).toEqual({ text: "Fakten", usage: { inputTokens: 6, outputTokens: 4 }, model: "gemini-3.5-flash" });
  });

  it("Fehlerklassen: 403 ist 'auth' und wird nicht wiederholt", async () => {
    sdk.generateContent.mockRejectedValue(sdkError(403, "API key not valid"));
    const error = await chatComplete({ system: "S", messages: history, override }).catch((e) => e);
    expect(classifyLlmFailure(error)).toBe("auth");
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
  });
});

// ─── Analyse über fetch (Z.ai und Custom-Slot teilen sich den Weg) ───────────

describe("analyzeComplete über fetch", () => {
  const OK = JSON.stringify({
    choices: [{ message: { content: " Fakten " } }],
    usage: { prompt_tokens: 1, completion_tokens: 2 },
  });
  const respond = (status: number, body: string) =>
    ({ ok: status >= 200 && status < 300, status, statusText: "", text: async () => body, json: async () => JSON.parse(body) }) as unknown as Response;

  it("Z.ai (Server-Standard): festes Ziel, thinking aus, 1500 Token, Kostenmodell ohne Bilder", async () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    const fetchMock = vi.fn(async () => respond(200, OK));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeComplete({ system: "SYS", text: "Quelle" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({ authorization: "Bearer zk", "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "glm-4.5-air",
      messages: [
        { role: "system", content: "SYS" },
        { role: "user", content: "Quelle" },
      ],
      max_tokens: 1500,
      stream: false,
      thinking: { type: "disabled" },
    });
    expect(result).toEqual({ text: "Fakten", usage: { inputTokens: 1, outputTokens: 2 }, model: "glm-4.5-air" });
  });

  it("Z.ai mit Bild: sehendes Modell und image_url als Data-URI, Text zuerst", async () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    const fetchMock = vi.fn(async () => respond(200, OK));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeComplete({ system: "SYS", text: "Quelle", images: [IMG] });

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model).toBe("glm-4.6v");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Quelle" },
        { type: "image_url", image_url: { url: IMG_URL } },
      ],
    });
    expect(result.model).toBe("glm-4.6v");
  });

  it("Z.ai: ZAI_MODEL und ZAI_VISION_MODEL überschreiben die Standardmodelle", async () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    vi.stubEnv("ZAI_MODEL", "glm-text-x");
    vi.stubEnv("ZAI_VISION_MODEL", "glm-vision-x");
    const fetchMock = vi.fn(async () => respond(200, OK));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeComplete({ system: "S", text: "T" });
    await analyzeComplete({ system: "S", text: "T", images: [IMG] });

    const models = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string).model);
    expect(models).toEqual(["glm-text-x", "glm-vision-x"]);
  });

  // Folgesitzung 2026-10-07: ein leer gesetztes `ZAI_MODEL=` ging als "model": "" an Z.ai.
  it("Z.ai: leer gesetzte ZAI_MODEL und ZAI_VISION_MODEL ergeben die Standardmodelle, nie ein leeres", async () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    vi.stubEnv("ZAI_MODEL", "");
    vi.stubEnv("ZAI_VISION_MODEL", "  ");
    const fetchMock = vi.fn(async () => respond(200, OK));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeComplete({ system: "S", text: "T" });
    await analyzeComplete({ system: "S", text: "T", images: [IMG] });

    const models = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string).model);
    expect(models).toEqual(["glm-4.5-air", "glm-4.6v"]);
  });

  it("Z.ai: der Schlüssel geht ohne Leerraum an den Anbieter (ein eingefügter Zeilenumbruch bräche den Header)", async () => {
    vi.stubEnv("ZAI_API_KEY", "zk\n");
    const fetchMock = vi.fn(async () => respond(200, OK));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeComplete({ system: "S", text: "T" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ authorization: "Bearer zk", "content-type": "application/json" });
  });

  it("Custom-Slot: eigene Adresse und eigenes Modell, trotzdem thinking aus (festgehalten wie es ist)", async () => {
    const fetchMock = vi.fn(async () => respond(200, OK));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeComplete({
      system: "SYS",
      text: "Quelle",
      override: { provider: "custom", apiKey: "ck", baseUrl: "https://api.example.test/v1/chat", model: "mein-modell" },
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/v1/chat");
    expect(init.headers).toEqual({ authorization: "Bearer ck", "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "mein-modell",
      max_tokens: 1500,
      stream: false,
      thinking: { type: "disabled" },
    });
    expect(result.model).toBe("mein-modell");
  });

  it("Custom-Slot: eine Fehlerantwort nennt den Anbieter und nur die geparste Meldung, nie den rohen Body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(401, "<html>geheimer Proxy-Text</html>"))
    );
    const error = await analyzeComplete({
      system: "S",
      text: "T",
      override: { provider: "custom", apiKey: "ck", baseUrl: "https://api.example.test/v1/chat", model: "m" },
    }).catch((e) => e);
    expect(error.message).toBe("Custom-Provider 401: ");
    expect(error.message).not.toContain("geheimer");
    expect(classifyLlmFailure(error)).toBe("auth");
  });

  it("ohne konfigurierten Anbieter (und ohne eigenen Key) gibt es einen klaren Fehler", async () => {
    await expect(analyzeComplete({ system: "S", text: "T" })).rejects.toThrow("no LLM provider configured");
    await expect(chatComplete({ system: "S", messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      "no LLM provider configured"
    );
  });
});

// ─── Z.ai: Token-Grenze und Standardwerte des Chats ──────────────────────────

describe("Standardwerte des Chats", () => {
  it("ohne eigene Grenze gehen 6144 Token an Z.ai, eigene Grenzen werden durchgereicht", async () => {
    vi.stubEnv("ZAI_API_KEY", "zk");
    const ok = JSON.stringify({ choices: [{ message: { content: "ok" } }] });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, statusText: "", text: async () => ok, json: async () => JSON.parse(ok) }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await chatComplete({ system: "S", messages: [{ role: "user", content: "x" }] });
    await chatComplete({ system: "S", messages: [{ role: "user", content: "x" }], maxOutputTokens: 99 });

    const tokens = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string).max_tokens);
    expect(tokens).toEqual([6144, 99]);
  });
});

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompleteStream, classifyLlmFailure, ZAI_FIRST_CHUNK_TIMEOUT_MS, type LlmOverride } from "@/server/llm";
import { __resetServerBreakerForTests } from "@/server/llm-failover";
import { SDK_FIRST_CHUNK_TIMEOUT_MS } from "@/server/llm/chat";
import {
  CUSTOM_FIRST_CHUNK_TIMEOUT_MS,
  STREAM_IDLE_TIMEOUT_MS,
  STREAM_TOTAL_TIMEOUT_CEILING_MS,
  STREAM_TOTAL_TIMEOUT_MS,
} from "@/server/llm/http";

// Zeitgrenzen eines Antwort-Stroms (#204, #392, #404): jeder Weg zum Modell hat eine Frist bis zum
// ersten Textstück und eine Leerlauf-Frist, die mit jedem Textstück neu startet; der ganze Zug hat
// eine Gesamtgrenze unter maxDuration der Route. Die drei SDKs laufen echt, nur fetch ist ersetzt: ob
// sie einen Abbruch als Fehler melden, entscheidet über das Aufräumen der Route.

vi.mock("node:dns", () => ({
  promises: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
}));

const message = [{ role: "user" as const, content: "hi" }];

/** Wie ein Anbieter Text und Ende auf die Leitung schreibt; `opening` kommt sofort, noch ohne Text. */
type Wire = { opening?: string[]; text: (text: string) => string; ending: string[] };

const openAiChunk = (choice: object) => `data: ${JSON.stringify({ choices: [{ index: 0, ...choice }] })}\n\n`;
const openAiWire: Wire = {
  text: (text) => openAiChunk({ delta: { content: text } }),
  ending: [openAiChunk({ delta: {}, finish_reason: "stop" }), "data: [DONE]\n\n"],
};

const anthropicEvent = (type: string, data: object = {}) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const anthropicMessage = { id: "m", type: "message", role: "assistant", model: "m", content: [], usage: { input_tokens: 1, output_tokens: 1 } };
const anthropicWire: Wire = {
  opening: [
    anthropicEvent("message_start", { message: anthropicMessage }),
    anthropicEvent("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
  ],
  text: (text) => anthropicEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text } }),
  ending: [
    anthropicEvent("content_block_stop", { index: 0 }),
    anthropicEvent("message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } }),
    anthropicEvent("message_stop"),
  ],
};

const geminiChunk = (candidate: object) => `data: ${JSON.stringify({ candidates: [candidate] })}\r\n\r\n`;
const geminiWire: Wire = {
  text: (text) => geminiChunk({ content: { role: "model", parts: [{ text }] } }),
  ending: [geminiChunk({ content: { role: "model", parts: [] }, finishReason: "STOP" })],
};

type Frame = { afterMs: number; text: string };

/**
 * Ein fetch, dessen Antwort Textstücke nach festen Abständen liefert und danach schweigt (`end`
 * false) oder endet. Wie echtes fetch bricht der Strom mit dem Grund des Signals ab.
 */
function slowFetch(frames: Frame[], end: boolean, wire: Wire = openAiWire) {
  const encoder = new TextEncoder();
  return vi.fn(async (_url: unknown, init: RequestInit) => {
    // Wie echtes fetch: mit einem schon abgebrochenen Signal geht gar nichts mehr hinaus.
    init.signal?.throwIfAborted();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of wire.opening ?? []) controller.enqueue(encoder.encode(line));
        let at = 0;
        for (const frame of frames) {
          at += frame.afterMs;
          timers.push(setTimeout(() => offer(controller, encoder.encode(wire.text(frame.text))), at));
        }
        if (end) {
          timers.push(
            setTimeout(() => {
              for (const line of wire.ending) controller.enqueue(encoder.encode(line));
              controller.close();
            }, at + 1)
          );
        }
        init.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
      },
      cancel() {
        for (const timer of timers) clearTimeout(timer);
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
}

/** enqueue wirft, sobald der Strom abgebrochen wurde: dann gibt es nichts mehr zu liefern. */
function offer(controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array) {
  try {
    controller.enqueue(chunk);
  } catch {
    // Strom schon beendet.
  }
}

async function collect(gen: AsyncGenerator<string>, out: string[] = []): Promise<string[]> {
  for await (const chunk of gen) out.push(chunk);
  return out;
}

type Start = (signal?: AbortSignal) => AsyncGenerator<string>;

/** Ein Zug mit eigenem Key, ohne `override` auf dem Server-Key. */
const turn =
  (override?: LlmOverride): Start =>
  (signal) =>
    chatCompleteStream({ system: "s", messages: message, override, signal });

const zai = turn();
const byok = turn({
  provider: "custom",
  apiKey: "k",
  baseUrl: "https://example.test/v1/chat/completions",
  model: "some-model",
});
/** Der Server-Anbieter Gemini: nur sein Schlüssel ist gesetzt, also auch kein Failover. */
const serverGemini: Start = (signal) => {
  vi.stubEnv("ZAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "gemini-key");
  return zai(signal);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("ZAI_API_KEY", "zai-key");
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each([
  ["Z.ai", zai, openAiWire, ZAI_FIRST_CHUNK_TIMEOUT_MS],
  ["Custom-Slot", byok, openAiWire, CUSTOM_FIRST_CHUNK_TIMEOUT_MS],
  ["Gemini als Server-Anbieter", serverGemini, geminiWire, SDK_FIRST_CHUNK_TIMEOUT_MS],
  ["Gemini mit eigenem Key", turn({ provider: "gemini", apiKey: "k" }), geminiWire, SDK_FIRST_CHUNK_TIMEOUT_MS],
  ["OpenAI mit eigenem Key", turn({ provider: "openai", apiKey: "k" }), openAiWire, SDK_FIRST_CHUNK_TIMEOUT_MS],
  ["Anthropic mit eigenem Key", turn({ provider: "anthropic", apiKey: "k" }), anthropicWire, SDK_FIRST_CHUNK_TIMEOUT_MS],
])("%s", (_name, start, wire, firstChunkMs) => {
  const stub = (frames: Frame[], end: boolean) => vi.stubGlobal("fetch", slowFetch(frames, end, wire));

  it("ein Strom, der nie ein Textstück schickt, endet nach der Frist für das erste mit TimeoutError", async () => {
    stub([], false);
    let ended = false;
    const result = collect(start())
      .catch((e) => e)
      .finally(() => (ended = true));

    await vi.advanceTimersByTimeAsync(firstChunkMs - 1);
    expect(ended).toBe(false);
    await vi.advanceTimersByTimeAsync(2);

    const err = await result;
    expect((err as DOMException).name).toBe("TimeoutError");
    expect(String((err as DOMException).message)).toContain("no first chunk");
  });

  it("ein Strom, der nach dem ersten Textstück schweigt, endet nach der Leerlauf-Frist mit TimeoutError", async () => {
    stub([{ afterMs: 1000, text: "Hallo" }], false);
    const seen: string[] = [];
    const result = collect(start(), seen).catch((e) => e);

    await vi.advanceTimersByTimeAsync(1000 + STREAM_IDLE_TIMEOUT_MS - 1);
    expect(seen).toEqual(["Hallo"]);
    await vi.advanceTimersByTimeAsync(2);

    const err = await result;
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("TimeoutError");
    expect(classifyLlmFailure(err)).toBe("unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("jedes Textstück startet die Leerlauf-Frist neu: 120 Sekunden stetiger Antwort werden vollständig gelesen", async () => {
    const frames = Array.from({ length: 12 }, (_, i) => ({ afterMs: 10_000, text: `${i};` }));
    stub(frames, true);
    const result = collect(start());

    await vi.advanceTimersByTimeAsync(130_000);

    expect((await result).join("")).toBe(frames.map((_, i) => `${i};`).join(""));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ein stetiger Strom, der nie endet, wird an der Gesamtgrenze abgebrochen", async () => {
    const frames = Array.from({ length: 40 }, (_, i) => ({ afterMs: 10_000, text: `${i};` }));
    stub(frames, false);
    const result = collect(start()).catch((e) => e);

    await vi.advanceTimersByTimeAsync(STREAM_TOTAL_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(2);

    const err = await result;
    expect((err as DOMException).name).toBe("TimeoutError");
    expect(String((err as DOMException).message)).toContain("stream not finished");
  });

  it("die Langsamkeit des Verbrauchers zählt nicht gegen den Anbieter", async () => {
    stub([{ afterMs: 100, text: "a" }, { afterMs: 100, text: "b" }], true);
    const gen = start();

    const first = gen.next();
    await vi.advanceTimersByTimeAsync(200);
    expect((await first).value).toBe("a");
    // Der Verbraucher braucht 100 s für das erste Stück: weit über der Leerlauf-Frist.
    await vi.advanceTimersByTimeAsync(100_000);

    expect(await collect(gen)).toEqual(["b"]);
  });

  it("der Abbruch des Nutzers bleibt ein AbortError, kein Zeitlimit", async () => {
    stub([{ afterMs: 100, text: "a" }], false);
    const controller = new AbortController();
    const result = collect(start(controller.signal)).catch((e) => e);

    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();

    expect(((await result) as Error).name).toBe("AbortError");
  });

  it("LLM_STREAM_IDLE_TIMEOUT_MS überschreibt die Leerlauf-Frist", async () => {
    vi.stubEnv("LLM_STREAM_IDLE_TIMEOUT_MS", "5000");
    stub([{ afterMs: 100, text: "a" }], false);
    const result = collect(start()).catch((e) => e);

    await vi.advanceTimersByTimeAsync(100 + 5000 + 1);

    expect(((await result) as DOMException).name).toBe("TimeoutError");
  });

  it("Unsinn in LLM_STREAM_IDLE_TIMEOUT_MS fällt auf den Standard zurück", async () => {
    vi.stubEnv("LLM_STREAM_IDLE_TIMEOUT_MS", "abc");
    stub([{ afterMs: 100, text: "a" }, { afterMs: 20_000, text: "b" }], true);
    const result = collect(start());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(await result).toEqual(["a", "b"]);
  });
});

/** `maxDuration` einer Route in Millisekunden, aus ihrem Quelltext. */
function maxDurationOf(route: "chat" | "test-run"): number {
  const source = readFileSync(new URL(`../../app/api/${route}/route.ts`, import.meta.url), "utf8");
  return Number(/export const maxDuration = (\d+)/.exec(source)?.[1]) * 1000;
}

describe("Gesamtgrenze", () => {
  it("liegt unter maxDuration beider Routen, die streamen, auch mit Überschreibung", async () => {
    for (const route of ["chat", "test-run"] as const) {
      expect(maxDurationOf(route)).toBeGreaterThan(0);
      expect(STREAM_TOTAL_TIMEOUT_MS).toBeLessThan(maxDurationOf(route));
      expect(STREAM_TOTAL_TIMEOUT_CEILING_MS).toBeLessThan(maxDurationOf(route));
    }

    vi.stubEnv("LLM_STREAM_TOTAL_TIMEOUT_MS", String(maxDurationOf("chat") * 2));
    vi.stubGlobal("fetch", slowFetch(Array.from({ length: 40 }, () => ({ afterMs: 10_000, text: "x" })), false));
    const result = collect(zai()).catch((e) => e);
    await vi.advanceTimersByTimeAsync(STREAM_TOTAL_TIMEOUT_CEILING_MS + 1);
    expect(((await result) as DOMException).name).toBe("TimeoutError");
  });

  it("LLM_STREAM_TOTAL_TIMEOUT_MS darf die Grenze senken", async () => {
    vi.stubEnv("LLM_STREAM_TOTAL_TIMEOUT_MS", "30000");
    vi.stubGlobal("fetch", slowFetch(Array.from({ length: 40 }, () => ({ afterMs: 10_000, text: "x" })), false));
    const result = collect(zai()).catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(((await result) as DOMException).name).toBe("TimeoutError");
  });
});

/** Eine Fehlerantwort, die erst nach `afterMs` kommt: spät genug, um viel Zeit zu kosten, früh genug für einen neuen Versuch. */
function lateError(status: number, afterMs: number, headers: Record<string, string> = {}) {
  return (_url: unknown, init: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response("{}", { status, headers })), afterMs);
      init.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(init.signal?.reason);
        },
        { once: true }
      );
    });
}

/** Ein stetiger Strom, der von sich aus nie endet. */
const endless = (wire: Wire = openAiWire) =>
  slowFetch(Array.from({ length: 60 }, () => ({ afterMs: 10_000, text: "x" })), false, wire);

describe("Gesamtfrist je Zug (#404)", () => {
  beforeEach(() => __resetServerBreakerForTests());

  /** Läuft den Zug unter der künstlichen Uhr bis zum Ende und sagt, womit und nach wie vielen Millisekunden er endete. */
  async function endOf(stream: AsyncGenerator<string>) {
    const startedAt = Date.now();
    const result = collect(stream).then(
      () => ({ error: undefined, afterMs: Date.now() - startedAt }),
      (error: unknown) => ({ error, afterMs: Date.now() - startedAt })
    );
    await vi.advanceTimersByTimeAsync(2 * maxDurationOf("chat"));
    return result;
  }

  it.each([
    // Zwei Fehler kurz vor der Frist für das erste Textstück, dann ein langsamer Strom: je Versuch gerechnet wäre
    // erst nach rund 330 s (Z.ai) bzw. 390 s (eigener Endpunkt) Schluss.
    ["Z.ai", zai, ZAI_FIRST_CHUNK_TIMEOUT_MS - 1000],
    ["Custom-Slot", byok, CUSTOM_FIRST_CHUNK_TIMEOUT_MS - 5000],
  ])("%s: zwei späte, wiederholbare Fehler und ein langer Strom enden vor maxDuration", async (_name, start, lateMs) => {
    const fetchMock = vi
      .fn(endless())
      .mockImplementationOnce(lateError(502, lateMs))
      .mockImplementationOnce(lateError(502, lateMs));
    vi.stubGlobal("fetch", fetchMock);

    const { error, afterMs } = await endOf(start());

    expect((error as DOMException).name).toBe("TimeoutError");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(afterMs).toBe(STREAM_TOTAL_TIMEOUT_MS);
    expect(afterMs).toBeLessThan(maxDurationOf("chat"));
  });

  it.each([
    ["ohne Ausweich-Anbieter", ""],
    ["auch nicht auf Gemini", "gemini-key"],
  ])("läuft die Frist während der Wartezeit ab, folgt kein weiterer Versuch, %s", async (_name, geminiKey) => {
    vi.stubEnv("GEMINI_API_KEY", geminiKey);
    vi.stubEnv("LLM_STREAM_TOTAL_TIMEOUT_MS", "30000");
    const fetchMock = vi.fn(endless()).mockImplementationOnce(lateError(503, 29_000, { "retry-after": "3" }));
    vi.stubGlobal("fetch", fetchMock);
    const providers: string[] = [];

    const { error, afterMs } = await endOf(
      chatCompleteStream({ system: "s", messages: message, onProvider: (p) => providers.push(p) })
    );

    expect((error as DOMException).name).toBe("TimeoutError");
    expect(afterMs).toBe(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(providers).not.toContain("gemini");
  });

  it("gilt auch über den Wechsel auf Gemini hinweg", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    const gemini = endless(geminiWire);
    const zaiDown = lateError(503, ZAI_FIRST_CHUNK_TIMEOUT_MS - 1000);
    vi.stubGlobal(
      "fetch",
      vi.fn((url: unknown, init: RequestInit) =>
        String(url).includes("api.z.ai") ? zaiDown(url, init) : gemini(url, init)
      )
    );

    const { error, afterMs } = await endOf(zai());

    expect((error as DOMException).name).toBe("TimeoutError");
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(afterMs).toBe(STREAM_TOTAL_TIMEOUT_MS);
  });

  it("zählt die Zeit seit Beginn der Anfrage: der Zug endet spätestens an der Obergrenze danach", async () => {
    vi.stubGlobal("fetch", endless());

    const { error, afterMs } = await endOf(
      chatCompleteStream({ system: "s", messages: message, requestStartedAt: Date.now() - 40_000 })
    );

    expect((error as DOMException).name).toBe("TimeoutError");
    expect(afterMs).toBe(STREAM_TOTAL_TIMEOUT_CEILING_MS - 40_000);
  });
});

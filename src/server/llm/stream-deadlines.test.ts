import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompleteStream, classifyLlmFailure } from "@/server/llm";
import {
  STREAM_IDLE_TIMEOUT_MS,
  STREAM_TOTAL_TIMEOUT_CEILING_MS,
  STREAM_TOTAL_TIMEOUT_MS,
} from "@/server/llm/http";

// Zeitgrenzen eines Antwort-Stroms (#204): Z.ai und der Custom-Slot teilen sich eine Frist bis
// zum ersten Textstück, eine Leerlauf-Frist, die mit jedem Textstück neu startet, und eine
// Gesamtgrenze unter maxDuration der Route.

vi.mock("node:dns", () => ({
  promises: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
}));

const custom = {
  provider: "custom" as const,
  apiKey: "k",
  baseUrl: "https://example.test/v1/chat/completions",
  model: "some-model",
};
const message = [{ role: "user" as const, content: "hi" }];

type Frame = { afterMs: number; text: string };

/**
 * Ein fetch, dessen Antwort Textstücke nach festen Abständen liefert und danach schweigt (`end`
 * false) oder endet. Wie echtes fetch bricht der Strom mit dem Grund des Signals ab.
 */
function slowFetch(frames: Frame[], end: boolean) {
  const encoder = new TextEncoder();
  const sse = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
  return vi.fn(async (_url: string, init: RequestInit) => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let at = 0;
        for (const frame of frames) {
          at += frame.afterMs;
          timers.push(setTimeout(() => offer(controller, encoder.encode(sse(frame.text))), at));
        }
        if (end) {
          timers.push(
            setTimeout(() => {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
    return { ok: true, status: 200, statusText: "", body, text: async () => "" } as unknown as Response;
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

const zai = (signal?: AbortSignal) => chatCompleteStream({ system: "s", messages: message, signal });
const byok = (signal?: AbortSignal) =>
  chatCompleteStream({ system: "s", messages: message, override: custom, signal });

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
  ["Z.ai", zai],
  ["Custom-Slot", byok],
])("%s", (_name, start) => {
  it("ein Strom, der nach dem ersten Textstück schweigt, endet nach der Leerlauf-Frist mit TimeoutError", async () => {
    vi.stubGlobal("fetch", slowFetch([{ afterMs: 1000, text: "Hallo" }], false));
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
    vi.stubGlobal("fetch", slowFetch(frames, true));
    const result = collect(start());

    await vi.advanceTimersByTimeAsync(130_000);

    expect((await result).join("")).toBe(frames.map((_, i) => `${i};`).join(""));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ein stetiger Strom, der nie endet, wird an der Gesamtgrenze abgebrochen", async () => {
    const frames = Array.from({ length: 40 }, (_, i) => ({ afterMs: 10_000, text: `${i};` }));
    vi.stubGlobal("fetch", slowFetch(frames, false));
    const result = collect(start()).catch((e) => e);

    await vi.advanceTimersByTimeAsync(STREAM_TOTAL_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(2);

    const err = await result;
    expect((err as DOMException).name).toBe("TimeoutError");
    expect(String((err as DOMException).message)).toContain("stream not finished");
  });

  it("die Langsamkeit des Verbrauchers zählt nicht gegen den Anbieter", async () => {
    vi.stubGlobal("fetch", slowFetch([{ afterMs: 100, text: "a" }, { afterMs: 100, text: "b" }], true));
    const gen = start();

    const first = gen.next();
    await vi.advanceTimersByTimeAsync(200);
    expect((await first).value).toBe("a");
    // Der Verbraucher braucht 100 s für das erste Stück: weit über der Leerlauf-Frist.
    await vi.advanceTimersByTimeAsync(100_000);

    expect(await collect(gen)).toEqual(["b"]);
  });

  it("der Abbruch des Nutzers bleibt ein AbortError, kein Zeitlimit", async () => {
    vi.stubGlobal("fetch", slowFetch([{ afterMs: 100, text: "a" }], false));
    const controller = new AbortController();
    const result = collect(start(controller.signal)).catch((e) => e);

    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();

    expect(((await result) as Error).name).toBe("AbortError");
  });

  it("LLM_STREAM_IDLE_TIMEOUT_MS überschreibt die Leerlauf-Frist", async () => {
    vi.stubEnv("LLM_STREAM_IDLE_TIMEOUT_MS", "5000");
    vi.stubGlobal("fetch", slowFetch([{ afterMs: 100, text: "a" }], false));
    const result = collect(start()).catch((e) => e);

    await vi.advanceTimersByTimeAsync(100 + 5000 + 1);

    expect(((await result) as DOMException).name).toBe("TimeoutError");
  });

  it("Unsinn in LLM_STREAM_IDLE_TIMEOUT_MS fällt auf den Standard zurück", async () => {
    vi.stubEnv("LLM_STREAM_IDLE_TIMEOUT_MS", "abc");
    vi.stubGlobal("fetch", slowFetch([{ afterMs: 100, text: "a" }, { afterMs: 20_000, text: "b" }], true));
    const result = collect(start());

    await vi.advanceTimersByTimeAsync(30_000);

    expect(await result).toEqual(["a", "b"]);
  });
});

describe("Gesamtgrenze", () => {
  it("liegt unter maxDuration der Chat-Route, auch mit Überschreibung", async () => {
    const route = readFileSync(new URL("../../app/api/chat/route.ts", import.meta.url), "utf8");
    const maxDuration = Number(/export const maxDuration = (\d+)/.exec(route)?.[1]) * 1000;
    expect(maxDuration).toBeGreaterThan(0);
    expect(STREAM_TOTAL_TIMEOUT_MS).toBeLessThan(maxDuration);
    expect(STREAM_TOTAL_TIMEOUT_CEILING_MS).toBeLessThan(maxDuration);

    vi.stubEnv("LLM_STREAM_TOTAL_TIMEOUT_MS", String(maxDuration * 2));
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

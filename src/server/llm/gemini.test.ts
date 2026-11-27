import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiAnalyze, geminiComplete, geminiCompleteStream } from "./gemini";

// Der echte SDK, nur fetch ist ersetzt: diese Tests halten die Adresse fest, die er wirklich aufruft.
// server/llm-providers.test.ts ersetzt den SDK und sieht nur, was ihm übergeben wird; ob er die
// API-Version auch anwendet, zeigt erst die Adresse. Ohne feste Version nähme der SDK `v1`, und dort
// fehlen Modelle, die auf `v1beta` laufen (config.ts, GEMINI_API_VERSION).

const reply = {
  candidates: [{ content: { role: "model", parts: [{ text: "ok" }] } }],
  usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 },
};

function urlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

/** Ersetzt fetch und gibt die Liste der aufgerufenen Adressen zurück. */
function captureFetch(respond: () => Response): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      urls.push(urlOf(input));
      return respond();
    })
  );
  return urls;
}

const base = { model: "gemini-3.5-flash", system: "S", maxOutputTokens: 100, apiKey: "test-key" };
const chat = { ...base, messages: [{ role: "user" as const, content: "x" }] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gemini über den echten SDK: API-Version v1beta", () => {
  it("generateContent im Chat geht an v1beta", async () => {
    const urls = captureFetch(() => Response.json(reply));

    const result = await geminiComplete(chat);

    expect(result).toEqual({ text: "ok", usage: { inputTokens: 3, outputTokens: 1 } });
    expect(urls).toHaveLength(1);
    const url = new URL(urls[0]);
    expect(url.host).toBe("generativelanguage.googleapis.com");
    expect(url.pathname).toBe("/v1beta/models/gemini-3.5-flash:generateContent");
  });

  it("streamGenerateContent geht an v1beta", async () => {
    const urls = captureFetch(
      () =>
        new Response(`data: ${JSON.stringify(reply)}\r\n\r\n`, {
          headers: { "content-type": "text/event-stream" },
        })
    );

    const chunks: string[] = [];
    for await (const chunk of geminiCompleteStream(chat)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["ok"]);
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]).pathname).toBe("/v1beta/models/gemini-3.5-flash:streamGenerateContent");
  });

  it("die Analyse des Projekt-Gedächtnisses geht an v1beta", async () => {
    const urls = captureFetch(() => Response.json(reply));

    await geminiAnalyze({ ...base, text: "T", images: [] });

    expect(new URL(urls[0]).pathname).toBe("/v1beta/models/gemini-3.5-flash:generateContent");
  });

  it("GOOGLE_GENAI_API_VERSION in der Umgebung ändert die Version nicht", async () => {
    vi.stubEnv("GOOGLE_GENAI_API_VERSION", "v1");
    const urls = captureFetch(() => Response.json(reply));

    await geminiComplete(chat);

    expect(new URL(urls[0]).pathname).toBe("/v1beta/models/gemini-3.5-flash:generateContent");
  });
});

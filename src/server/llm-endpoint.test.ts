import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeComplete, chatCompleteStream, llmConfig, selfHostedEndpointActive } from "@/server/llm";
import { endpointChatUrl } from "@/server/llm/config";

// Der eigene OpenAI-kompatible Endpunkt des Betreibers (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY) als Server-Anbieter,
// und die Regel, dass nur er im Einzelbetrieb (SELF_HOSTED=1) lokal sein darf, nie ein Endpunkt eines Nutzers.

const lookup = vi.fn();
vi.mock("node:dns", () => ({ promises: { lookup: (...a: unknown[]) => lookup(...a) } }));

const SSE = 'data: {"choices":[{"delta":{"content":"Hallo"}}]}\n\ndata: {"choices":[{"delta":{"content":" Welt"}}]}\n\ndata: [DONE]\n\n';
const sse = () => new Response(SSE, { status: 200, headers: { "content-type": "text/event-stream" } });
const json = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: " Fakten " } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const chunk of gen) out += chunk;
  return out;
}

const turn = { system: "SYS", messages: [{ role: "user" as const, content: "Idee" }] };

function selfHostedOllama() {
  vi.stubEnv("SELF_HOSTED", "1");
  vi.stubEnv("LLM_BASE_URL", "http://localhost:11434/v1");
  vi.stubEnv("LLM_MODEL", "qwen3");
}

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  for (const name of ["ZAI_API_KEY", "GEMINI_API_KEY", "SELF_HOSTED", "VERCEL", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"]) {
    vi.stubEnv(name, "");
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Auswahl des Server-Anbieters", () => {
  it("nimmt den eigenen Endpunkt mit Adresse und Modell", () => {
    selfHostedOllama();
    expect(llmConfig()).toEqual({ provider: "endpoint", model: "qwen3" });
  });

  it("ohne Modell gibt es keinen Endpunkt, auch keinen geratenen", () => {
    vi.stubEnv("LLM_BASE_URL", "http://localhost:11434/v1");
    expect(llmConfig()).toBeNull();
  });

  it("ein gesetzter Z.ai- oder Gemini-Key kommt zuerst, wie bisher", () => {
    selfHostedOllama();
    vi.stubEnv("ZAI_API_KEY", "zk");
    expect(llmConfig()?.provider).toBe("zai");
    vi.stubEnv("ZAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gk");
    expect(llmConfig()?.provider).toBe("gemini");
  });

  it("selfHostedEndpointActive nur mit SELF_HOSTED=1, ausserhalb von Vercel, auf dem eigenen Endpunkt", () => {
    selfHostedOllama();
    expect(selfHostedEndpointActive()).toBe(true);
    vi.stubEnv("VERCEL", "1");
    expect(selfHostedEndpointActive()).toBe(false);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("SELF_HOSTED", "");
    expect(selfHostedEndpointActive()).toBe(false);
    vi.stubEnv("SELF_HOSTED", "1");
    vi.stubEnv("ZAI_API_KEY", "zk");
    expect(selfHostedEndpointActive()).toBe(false);
  });

  it("baut die Chat-Adresse aus der Basis, wie OpenAI-SDKs und Ollama", () => {
    for (const [base, url] of [
      ["http://localhost:11434/v1", "http://localhost:11434/v1/chat/completions"],
      ["http://localhost:11434/v1/", "http://localhost:11434/v1/chat/completions"],
      ["http://localhost:1234/v1/chat/completions", "http://localhost:1234/v1/chat/completions"],
      ["https://openrouter.ai/api/v1", "https://openrouter.ai/api/v1/chat/completions"],
    ]) {
      vi.stubEnv("LLM_BASE_URL", base);
      expect(endpointChatUrl(), base).toBe(url);
    }
  });
});

describe("Chat über den eigenen Endpunkt", () => {
  it("streamt im Einzelbetrieb von Ollama auf localhost, ohne Authorization-Kopf und ohne Z.ai-Felder", async () => {
    selfHostedOllama();
    const fetchMock = vi.fn(async () => sse());
    vi.stubGlobal("fetch", fetchMock);

    expect(await collect(chatCompleteStream(turn))).toBe("Hallo Welt");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.redirect).toBe("error");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "qwen3", stream: true, max_tokens: 6144 });
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(body).not.toHaveProperty("thinking");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("schickt LLM_API_KEY als Bearer, wenn er gesetzt ist", async () => {
    selfHostedOllama();
    vi.stubEnv("LLM_API_KEY", " sk-lokal \n");
    const fetchMock = vi.fn(async () => sse());
    vi.stubGlobal("fetch", fetchMock);
    await collect(chatCompleteStream(turn));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toEqual({ authorization: "Bearer sk-lokal", "content-type": "application/json" });
  });

  it("wiederholt einen vorübergehenden Fehler über llm-retry.ts", async () => {
    selfHostedOllama();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(sse());
    vi.stubGlobal("fetch", fetchMock);
    const onRetry = vi.fn();

    expect(await collect(chatCompleteStream({ ...turn, onRetry }))).toBe("Hallo Welt");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["ohne SELF_HOSTED", {}],
    ["mit SELF_HOSTED=1 auf Vercel", { VERCEL: "1" }],
  ])("verweigert eine lokale http-Adresse %s, ohne sie anzufragen", async (_label, extra) => {
    selfHostedOllama();
    vi.stubEnv("SELF_HOSTED", "");
    if ("VERCEL" in extra) {
      vi.stubEnv("SELF_HOSTED", "1");
      vi.stubEnv("VERCEL", "1");
    }
    const fetchMock = vi.fn(async () => sse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(collect(chatCompleteStream(turn))).rejects.toThrow("Nur https://");
    vi.stubEnv("LLM_BASE_URL", "https://127.0.0.1:11434/v1");
    await expect(collect(chatCompleteStream(turn))).rejects.toThrow("nicht erlaubt");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Endpunkte der Nutzer (BYOK) bleiben im Einzelbetrieb gesperrt", () => {
  const byok = (baseUrl: string) => ({ provider: "custom" as const, apiKey: "ck", baseUrl, model: "m" });

  it.each([
    "http://localhost:11434/v1/chat/completions",
    "https://localhost/v1/chat/completions",
    "https://127.0.0.1/v1/chat/completions",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.20/v1/chat/completions",
  ])("Chat: %s", async (baseUrl) => {
    selfHostedOllama();
    const fetchMock = vi.fn(async () => sse());
    vi.stubGlobal("fetch", fetchMock);
    await expect(collect(chatCompleteStream({ ...turn, override: byok(baseUrl) }))).rejects.toThrow(
      /Nur https:\/\/|nicht erlaubt/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Analyse: ein Name, der ins eigene Netz zeigt", async () => {
    selfHostedOllama();
    lookup.mockResolvedValue([{ address: "10.0.0.7", family: 4 }]);
    const fetchMock = vi.fn(async () => json());
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      analyzeComplete({ system: "S", text: "T", override: byok("https://intern.example/v1/chat/completions") })
    ).rejects.toThrow("nicht erlaubt");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Projekt-Gedächtnis über den eigenen Endpunkt", () => {
  it("analysiert im Einzelbetrieb auf localhost, ohne Z.ai-Felder, und nennt das Modell", async () => {
    selfHostedOllama();
    const fetchMock = vi.fn(async () => json());
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeComplete({ system: "SYS", text: "Quelle" });

    expect(result).toMatchObject({ text: "Fakten", model: "qwen3" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "qwen3", stream: false });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("ein GLM-Modell hinter dem eigenen Endpunkt bekommt die Felder von Z.ai nicht, der Host entscheidet", async () => {
    selfHostedOllama();
    vi.stubEnv("LLM_MODEL", "glm-4.5-air");
    const fetchMock = vi.fn(async () => json());
    vi.stubGlobal("fetch", fetchMock);

    await analyzeComplete({ system: "S", text: "T" });

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ model: "glm-4.5-air" });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("LLM_BASE_URL auf api.z.ai ist Z.ai: die Felder gehen mit wie beim Server-Key", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://api.z.ai/api/paas/v4");
    vi.stubEnv("LLM_MODEL", "glm-4.5-air");
    const fetchMock = vi.fn(async () => json());
    vi.stubGlobal("fetch", fetchMock);

    await analyzeComplete({ system: "S", text: "T" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "glm-4.5-air", thinking: { type: "disabled" } });
  });

  it("verweigert dieselbe Adresse ohne SELF_HOSTED", async () => {
    selfHostedOllama();
    vi.stubEnv("SELF_HOSTED", "");
    const fetchMock = vi.fn(async () => json());
    vi.stubGlobal("fetch", fetchMock);
    await expect(analyzeComplete({ system: "S", text: "T" })).rejects.toThrow("Nur https://");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

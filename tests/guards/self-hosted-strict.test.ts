import { afterEach, describe, expect, it, vi } from "vitest";

// Ohne Einzelbetrieb ist alles so streng wie vor SELF_HOSTED. Eine Datei, die jede Stelle prüft, an der der Schalter
// etwas lockert, für Umgebungen wie promptprinter.app (Vercel, Produktion) und für falsch gesetzte Werte. Die
// Gegenprobe (SELF_HOSTED=1 auf einem eigenen Rechner) steht am Ende: sie zeigt, dass die Prüfungen den Unterschied
// überhaupt sehen können.

vi.mock("node:dns", () => ({ promises: { lookup: async () => [{ address: "10.0.0.7", family: 4 }] } }));

const BASE: Record<string, string> = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  ZAI_API_KEY: "",
  GEMINI_API_KEY: "",
  LLM_BASE_URL: "http://localhost:11434/v1",
  LLM_MODEL: "qwen3",
  LLM_API_KEY: "",
};

const STRICT: [string, Record<string, string>][] = [
  ["promptprinter.app (Vercel, kein SELF_HOSTED)", { VERCEL: "1", SELF_HOSTED: "" }],
  ["SELF_HOSTED=1 auf Vercel", { VERCEL: "1", SELF_HOSTED: "1" }],
  ["eigene Installation ohne SELF_HOSTED", { VERCEL: "", SELF_HOSTED: "" }],
  ["SELF_HOSTED=true", { VERCEL: "", SELF_HOSTED: "true" }],
  ["SELF_HOSTED=yes", { VERCEL: "", SELF_HOSTED: "yes" }],
];

async function fresh(env: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries({ ...BASE, ...env })) vi.stubEnv(name, value);
  const [envModule, rateLimitModule, llm, health] = await Promise.all([
    import("@/server/env"),
    import("@/server/security/rate-limit"),
    import("@/server/llm"),
    import("@/app/api/health/route"),
  ]);
  return { ...envModule, ...rateLimitModule, ...llm, health: health.GET };
}

async function drain(gen: AsyncGenerator<string>) {
  for await (const chunk of gen) void chunk;
}

const turn = { system: "S", messages: [{ role: "user" as const, content: "x" }] };
const byok = { provider: "custom" as const, apiKey: "ck", baseUrl: "https://intern.example/v1/chat/completions", model: "m" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe.each(STRICT)("so streng wie vorher: %s", (_label, env) => {
  it("Startprüfung: Upstash ist Pflicht", async () => {
    const { missingProductionEnv } = await fresh(env);
    expect(missingProductionEnv().map((m) => m.name)).toEqual(
      expect.arrayContaining(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"])
    );
  });

  it("Ratenlimit: ohne Upstash geschlossen", async () => {
    const { rateLimit } = await fresh(env);
    expect((await rateLimit("ip:strict", { limit: 100, windowMs: 60_000 })).allowed).toBe(false);
  });

  it("/api/health: ohne Upstash 503", async () => {
    const { health } = await fresh(env);
    expect(health().status).toBe(503);
  });

  it("Kostenkette: der Endpunkt hebt Plan und Gratis-Rahmen nicht auf", async () => {
    const { selfHostedEndpointActive } = await fresh(env);
    expect(selfHostedEndpointActive()).toBe(false);
  });

  it("Server-Endpunkt: lokale http-Adresse wird nicht angefragt", async () => {
    const { chatCompleteStream } = await fresh(env);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(drain(chatCompleteStream(turn))).rejects.toThrow("Nur https://");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("BYOK-Endpunkt: ein Name im eigenen Netz wird nicht angefragt", async () => {
    const { chatCompleteStream } = await fresh(env);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(drain(chatCompleteStream({ ...turn, override: byok }))).rejects.toThrow("nicht erlaubt");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Gegenprobe: SELF_HOSTED=1 auf einem eigenen Rechner lockert genau diese Stellen", () => {
  const selfHosted = { VERCEL: "", SELF_HOSTED: "1" };

  it("Startprüfung, Ratenlimit, /api/health und Kostenkette", async () => {
    const { missingProductionEnv, rateLimit, health, selfHostedEndpointActive } = await fresh(selfHosted);
    expect(missingProductionEnv().map((m) => m.name)).not.toContain("UPSTASH_REDIS_REST_URL");
    expect((await rateLimit("ip:self", { limit: 100, windowMs: 60_000 })).allowed).toBe(true);
    expect(health().status).toBe(200);
    expect(selfHostedEndpointActive()).toBe(true);
  });

  it("der Server-Endpunkt darf lokal sein, der BYOK-Endpunkt nicht", async () => {
    const { chatCompleteStream } = await fresh(selfHosted);
    const fetchMock = vi.fn(async () => new Response("data: [DONE]\n\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await drain(chatCompleteStream(turn));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(drain(chatCompleteStream({ ...turn, override: byok }))).rejects.toThrow("nicht erlaubt");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

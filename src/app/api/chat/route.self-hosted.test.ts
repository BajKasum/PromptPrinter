import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Die Kostenkette (server/model-call.ts) im Einzelbetrieb: ein Zug ohne eigenen Key auf dem Endpunkt des Betreibers
// zählt nicht gegen den Gratis-Rahmen und braucht keine Einwilligung zu Z.ai. Stundenlimit und Tagesbudget
// bleiben. Ohne SELF_HOSTED, auf Vercel oder auf Z.ai gilt alles wie auf promptprinter.app.
//
// Anders als route.exits.test.ts ist llmConfig hier NICHT ersetzt: die Auswahl des Anbieters kommt aus der Umgebung,
// genau wie in einer echten Installation. Ersetzt sind nur Supabase, die Zähler und der Modellaufruf selbst.

const log: string[] = [];
const getUser = vi.fn();
const rateLimit = vi.fn();
const reserveServerKeyCall = vi.fn();
const getUserOverride = vi.fn();
const chatCompleteStream = vi.fn();
const freePromptsLeft = vi.fn();
const reserveFreeTrialTurn = vi.fn();
let plan = "free";
let isAdmin = false;
let appMetadata: unknown = {};

function builder(table: string) {
  const result = () => {
    if (table === "profiles") return { data: { plan, is_admin: isAdmin }, error: null };
    if (table === "messages") return { data: { id: "msg-1" }, error: null, count: 0 };
    if (table === "conversations") return { data: { id: "conv-1" }, error: null };
    return { data: table === "project_files" ? [] : null, error: null };
  };
  const chain: Record<string, unknown> = {
    maybeSingle: vi.fn(async () => result()),
    single: vi.fn(async () => result()),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const method of ["select", "eq", "gte", "is", "order", "limit", "update", "insert", "delete"]) {
    chain[method] = vi.fn(() => chain);
  }
  return chain;
}

const supabaseStub = {
  auth: { getUser },
  from: (table: string) => builder(table),
  storage: { from: () => ({ download: async () => ({ data: null, error: new Error("n/a") }) }) },
};

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => supabaseStub,
  createClientForRequest: async () => supabaseStub,
}));
vi.mock("@/server/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security/rate-limit")>();
  return {
    ...actual,
    rateLimit: (...a: unknown[]) => rateLimit(...a),
    rateLimitKey: () => "u:user-1",
    reserveServerKeyCall: (...a: unknown[]) => reserveServerKeyCall(...a),
  };
});
vi.mock("@/server/byok", () => ({ getUserOverride: (...a: unknown[]) => getUserOverride(...a) }));
vi.mock("@/server/free-trial", () => ({
  freePromptsLeft: (...a: unknown[]) => freePromptsLeft(...a),
  reserveFreeTrialTurn: (...a: unknown[]) => reserveFreeTrialTurn(...a),
}));
vi.mock("@/server/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/llm")>();
  return { ...actual, chatCompleteStream: (...a: unknown[]) => chatCompleteStream(...a) };
});

const req = () =>
  new Request("https://pp.example.org/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
  });

function ollama(extra: Record<string, string> = {}) {
  const env = { SELF_HOSTED: "1", VERCEL: "", LLM_BASE_URL: "http://localhost:11434/v1", LLM_MODEL: "qwen3", ...extra };
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

async function problemOf(res: Response): Promise<{ status: number; kind?: string }> {
  return { status: res.status, kind: res.status >= 400 ? (await res.json()).kind : undefined };
}

beforeEach(() => {
  vi.clearAllMocks();
  log.length = 0;
  plan = "free";
  isAdmin = false;
  appMetadata = {};
  for (const name of ["ZAI_API_KEY", "GEMINI_API_KEY", "LLM_API_KEY"]) vi.stubEnv(name, "");
  getUser.mockImplementation(async () => ({ data: { user: { id: "user-1", app_metadata: appMetadata } } }));
  getUserOverride.mockResolvedValue(null);
  freePromptsLeft.mockResolvedValue(0);
  reserveFreeTrialTurn.mockResolvedValue("exhausted");
  rateLimit.mockImplementation(async () => {
    log.push("rateLimit");
    return { allowed: true, remaining: 1, resetAt: Date.now() + 1000 };
  });
  reserveServerKeyCall.mockImplementation(async () => {
    log.push("reserveServerKeyCall");
    return { allowed: true, release: async () => {} };
  });
  chatCompleteStream.mockImplementation(async function* () {
    log.push("model");
    yield "Hallo";
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("Einzelbetrieb auf dem Endpunkt des Betreibers", () => {
  it("ein Konto ohne Key chattet: kein Gratis-Rahmen, keine Einwilligung", async () => {
    ollama();
    const res = await POST(req());
    expect(res.status).toBe(200);
    await res.text();

    expect(log).toEqual(["rateLimit", "reserveServerKeyCall", "model"]);
    expect(freePromptsLeft).not.toHaveBeenCalled();
    expect(reserveFreeTrialTurn).not.toHaveBeenCalled();
  });

  it("das Stundenlimit gilt weiter", async () => {
    ollama();
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    expect((await POST(req())).status).toBe(429);
    expect(chatCompleteStream).not.toHaveBeenCalled();
  });

  it("das Tagesbudget gilt weiter", async () => {
    ollama();
    reserveServerKeyCall.mockResolvedValue({ allowed: false, release: async () => {} });
    expect((await POST(req())).status).toBe(503);
    expect(chatCompleteStream).not.toHaveBeenCalled();
  });
});

describe("ohne Einzelbetrieb bleibt die Kette so streng wie vorher", () => {
  it.each([
    ["ohne SELF_HOSTED", { SELF_HOSTED: "" }],
    ["mit SELF_HOSTED=true statt 1", { SELF_HOSTED: "true" }],
    ["auf Vercel", { VERCEL: "1" }],
  ])("Free ohne Key und ohne Gratis-Prompts: byokRequired, %s", async (_label, extra) => {
    ollama(extra);
    expect(await problemOf(await POST(req()))).toEqual({ status: 403, kind: "byokRequired" });
    expect(chatCompleteStream).not.toHaveBeenCalled();
  });

  it("ein altes Konto mit plan = 'pro' ohne Einzelbetrieb ist Free: byokRequired, kein Server-Key", async () => {
    ollama({ SELF_HOSTED: "" });
    plan = "pro";
    expect(await problemOf(await POST(req()))).toEqual({ status: 403, kind: "byokRequired" });
    expect(reserveServerKeyCall).not.toHaveBeenCalled();
    expect(chatCompleteStream).not.toHaveBeenCalled();
  });

  it("mit SELF_HOSTED=1, aber auf Z.ai: Gratis-Rahmen und Einwilligung gelten wie auf promptprinter.app", async () => {
    ollama({ ZAI_API_KEY: "zk" });
    expect(await problemOf(await POST(req()))).toEqual({ status: 403, kind: "byokRequired" });
    isAdmin = true;
    expect(await problemOf(await POST(req()))).toEqual({ status: 403, kind: "consentRequired" });
    expect(chatCompleteStream).not.toHaveBeenCalled();
  });
});

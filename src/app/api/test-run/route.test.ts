import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/server/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
const reserveModelCall = vi.fn();
vi.mock("@/server/model-call", () => ({ reserveModelCall: (...a: unknown[]) => reserveModelCall(...a) }));
const chatCompleteStream = vi.fn();
vi.mock("@/server/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/llm")>();
  return { ...actual, chatCompleteStream: (...a: unknown[]) => chatCompleteStream(...a), llmConfig: () => ({ provider: "zai", model: "glm-4.5-air" }) };
});
vi.mock("@/server/security/rate-limit", () => ({ rateLimit: vi.fn(), rateLimitKey: () => "k" }));

const { POST } = await import("./route");
const { TEST_RUN_MAX_OUTPUT_TOKENS, TEST_RUN_MAX_PROMPT_CHARS, TEST_RUN_SYSTEM } = await import("@/shared/lib/test-run");

const req = (body: unknown) =>
  new Request("https://promptprinter.app/api/test-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const release = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: {} } } });
  reserveModelCall.mockResolvedValue({ override: null, plan: "pro", isAdmin: false, freeTrial: null, releaseReservations: release });
  chatCompleteStream.mockImplementation(async function* () {
    yield "Sehr geehrte ";
    yield "Frau Muster";
  });
});

describe("POST /api/test-run", () => {
  it("schickt den Prompt unverändert, ohne Finns Systemprompt, mit begrenzter Ausgabe, und gibt die Antwort zurück", async () => {
    const res = await POST(req({ prompt: "Rolle: Du bist ...\n\nAufgabe: Schreib einen Brief." }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-ai-generated")).toBe("true");
    expect(await res.json()).toEqual({ reply: "Sehr geehrte Frau Muster" });
    const call = chatCompleteStream.mock.calls[0][0];
    expect(call.system).toBe(TEST_RUN_SYSTEM);
    expect(call.messages).toEqual([{ role: "user", content: "Rolle: Du bist ...\n\nAufgabe: Schreib einen Brief." }]);
    expect(call.maxOutputTokens).toBe(TEST_RUN_MAX_OUTPUT_TOKENS);
    expect(release).not.toHaveBeenCalled();
  });

  it("läuft durch dieselbe Kostenkette, im Gratis-Rahmen als Probelauf dieses einen Prompts", async () => {
    await POST(req({ prompt: "Ein Prompt" }));
    await POST(req({ prompt: "Ein Prompt" }));
    await POST(req({ prompt: "Ein anderer" }));

    const [a, b, c] = reserveModelCall.mock.calls.map(([opts]) => opts.freeTrial.testRunOf.promptHash);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(reserveModelCall.mock.calls[0][0].stubOutsideProduction).toBe(false);
  });

  it("ohne Anmeldung 401, ohne Modell", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({ prompt: "x" }))).status).toBe(401);
    expect(reserveModelCall).not.toHaveBeenCalled();
  });

  it("leerer oder zu langer Prompt 400, ohne Reservierung", async () => {
    expect((await POST(req({ prompt: "  " }))).status).toBe(400);
    expect((await POST(req({ prompt: "x".repeat(TEST_RUN_MAX_PROMPT_CHARS + 1) }))).status).toBe(400);
    expect(reserveModelCall).not.toHaveBeenCalled();
  });

  it("gibt eine Absage der Kostenkette unverändert weiter", async () => {
    reserveModelCall.mockResolvedValue(new Response(JSON.stringify({ kind: "testRunUsed" }), { status: 403 }));
    const res = await POST(req({ prompt: "x" }));
    expect(res.status).toBe(403);
    expect(chatCompleteStream).not.toHaveBeenCalled();
  });

  it("scheitert der Anbieter, gehen die Reservierungen zurück und die Meldung verrät nichts", async () => {
    chatCompleteStream.mockImplementation(async function* () {
      throw new Error("upstream 500 secret detail");
    });
    const res = await POST(req({ prompt: "x" }));
    expect(res.status).toBe(502);
    expect(release).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });

  it("eine leere Antwort zählt als gescheitert", async () => {
    chatCompleteStream.mockImplementation(async function* () {
      yield "  ";
    });
    expect((await POST(req({ prompt: "x" }))).status).toBe(502);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

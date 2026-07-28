import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Guards the fix for QA finding S-1: /api/chat used to serve anonymous callers,
// which skipped the whole monthly-quota block (it hung off `userId`) and ran
// straight against the server's own provider key, bounded only by an hourly
// limit keyed on a caller-controlled header. These tests exist so that path
// cannot quietly come back — an anonymous request must never reach the model.

const getUser = vi.fn();
const createClient = vi.fn();
const rateLimit = vi.fn();
const rateLimitKey = vi.fn();
const reserveMonthlyQuota = vi.fn();
const reserveServerKeyCall = vi.fn();
const getUserOverride = vi.fn();
const chatCompleteStream = vi.fn();
const llmConfig = vi.fn();

// Per-table canned results. PostgREST builders are thenable and every filter
// method returns the builder itself, so one shape covers select/insert/update
// chains alike: `await from("x").select().eq()` and `.maybeSingle()` both
// resolve to the same object, and each call site destructures the field it
// wants (data / error / count).
const tableResults: Record<string, { data?: unknown; error?: unknown; count?: number }> = {};

function builder(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null, count: 0 };
  const chain: Record<string, unknown> = {
    maybeSingle: vi.fn(async () => result()),
    single: vi.fn(async () => result()),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const method of ["select", "eq", "gte", "is", "order", "limit", "insert", "update"]) {
    chain[method] = vi.fn(() => chain);
  }
  return chain;
}

const supabaseStub = {
  auth: { getUser },
  from: (table: string) => builder(table),
  storage: { from: () => ({ download: async () => ({ data: null, error: new Error("n/a") }) }) },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: (...a: unknown[]) => rateLimitKey(...a),
  reserveMonthlyQuota: (...a: unknown[]) => reserveMonthlyQuota(...a),
  reserveServerKeyCall: (...a: unknown[]) => reserveServerKeyCall(...a),
}));
vi.mock("@/lib/byok", () => ({ getUserOverride: (...a: unknown[]) => getUserOverride(...a) }));
// Mocked so the test never pulls in the three provider SDKs, and so "did the
// model get called" is directly assertable.
vi.mock("@/lib/llm", () => ({
  chatCompleteStream: (...a: unknown[]) => chatCompleteStream(...a),
  llmConfig: () => llmConfig(),
}));

function req(body: unknown = { mode: "general", messages: [{ role: "user", content: "Hi" }] }) {
  return new Request("https://promptprinter.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readSse(res: Response): Promise<string> {
  return await res.text();
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue(supabaseStub);
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 119, resetAt: Date.now() + 1000 });
    rateLimitKey.mockReturnValue("u:user-1");
    reserveMonthlyQuota.mockResolvedValue(null);
    reserveServerKeyCall.mockResolvedValue(null);
    getUserOverride.mockResolvedValue(null);
    llmConfig.mockReturnValue({ provider: "zai", model: "glm-4.5-air" });
    chatCompleteStream.mockImplementation(async function* () {
      yield "Hallo";
    });
    tableResults.profiles = { data: { plan: "free", is_admin: false } };
    tableResults.messages = { data: null, error: null, count: 3 };
    tableResults.conversations = { data: { id: "conv-1" }, error: null };
    tableResults.projects = { data: null, error: null };
    tableResults.generations = { data: null, error: null };
    tableResults.project_files = { data: [], error: null };
  });

  describe("authentication (QA finding S-1)", () => {
    it("rejects an anonymous request with 401 and never calls the model", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      const res = await POST(req());

      expect(res.status).toBe(401);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("does not consume rate limit or quota for an anonymous request", async () => {
      getUser.mockResolvedValue({ data: { user: null } });

      await POST(req());

      expect(rateLimit).not.toHaveBeenCalled();
      expect(reserveMonthlyQuota).not.toHaveBeenCalled();
    });

    it("treats a failing auth lookup as signed-out rather than anonymous-allowed", async () => {
      getUser.mockRejectedValue(new Error("auth service down"));

      const res = await POST(req());

      expect(res.status).toBe(401);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("returns 503 instead of running on the server key when Supabase is unavailable", async () => {
      createClient.mockRejectedValue(new Error("no supabase configured"));

      const res = await POST(req());

      expect(res.status).toBe(503);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("buckets the rate limit by user id, never by a request header", async () => {
      await POST(req());

      expect(rateLimitKey).toHaveBeenCalledWith(expect.anything(), "user-1");
    });
  });

  describe("signed-in happy path", () => {
    it("streams the reply as SSE", async () => {
      const res = await POST(req());

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const body = await readSse(res);
      expect(body).toContain("event: delta");
      expect(body).toContain("Hallo");
      expect(body).toContain("event: done");
    });

    it("falls back to the stub reply when no provider is configured", async () => {
      llmConfig.mockReturnValue(null);

      const body = await readSse(await POST(req()));

      expect(chatCompleteStream).not.toHaveBeenCalled();
      expect(body).toContain("Demo-Antwort");
    });
  });

  // QA finding C-8: an unconfigured production deploy used to answer every
  // user with the stub template — a plausible-looking placeholder — instead
  // of failing visibly. NODE_ENV defaults to "test" for the rest of this file,
  // so these are the only cases that exercise the production branch.
  describe("unconfigured in production (QA finding C-8)", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    afterEach(() => {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test");
    });

    it("refuses with 503 instead of answering with the stub template", async () => {
      vi.stubEnv("NODE_ENV", "production");
      llmConfig.mockReturnValue(null);

      const res = await POST(req());

      expect(res.status).toBe(503);
      expect(chatCompleteStream).not.toHaveBeenCalled();
      const json = (await res.json()) as { detail: string };
      expect(json.detail).not.toContain("Demo-Antwort");
    });

    it("releases any held reservation when refusing", async () => {
      vi.stubEnv("NODE_ENV", "production");
      llmConfig.mockReturnValue(null);
      const release = vi.fn().mockResolvedValue(undefined);
      reserveMonthlyQuota.mockResolvedValue({ allowed: true, release });

      await POST(req());

      expect(release).toHaveBeenCalled();
    });

    it("still answers for real once a provider is configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      // llmConfig already returns a real provider via the shared beforeEach.

      const res = await POST(req());

      expect(res.status).toBe(200);
      expect(chatCompleteStream).toHaveBeenCalled();
    });

    it("still answers for real on a BYOK override, even with no server provider", async () => {
      vi.stubEnv("NODE_ENV", "production");
      llmConfig.mockReturnValue(null);
      getUserOverride.mockResolvedValue({ provider: "anthropic", apiKey: "sk-test" });

      const res = await POST(req());

      expect(res.status).toBe(200);
      expect(chatCompleteStream).toHaveBeenCalled();
    });
  });

  describe("limits", () => {
    it("rejects with 403 once the monthly chat allowance is used up", async () => {
      // Free plan allows 200; the DB-count fallback applies because
      // reserveMonthlyQuota returns null (no Redis).
      tableResults.messages = { data: null, error: null, count: 200 };

      const res = await POST(req());

      expect(res.status).toBe(403);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("skips the monthly allowance entirely for a BYOK user", async () => {
      tableResults.messages = { data: null, error: null, count: 5000 };
      getUserOverride.mockResolvedValue({ provider: "anthropic", apiKey: "sk-test" });

      const res = await POST(req());

      expect(res.status).toBe(200);
      expect(reserveMonthlyQuota).not.toHaveBeenCalled();
    });

    it("rejects with 429 once the hourly rate limit is exceeded", async () => {
      rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

      const res = await POST(req());

      expect(res.status).toBe(429);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("skips the hourly rate limit for admin accounts", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: true } };

      const res = await POST(req());

      expect(rateLimit).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  // QA finding S-1, step 4: a global ceiling on the operator's own key, so the
  // next hole nobody has found yet is bounded by one day's budget instead of
  // by nothing at all.
  describe("global daily server-key budget", () => {
    const release = vi.fn().mockResolvedValue(undefined);

    it("refuses with 503 once the daily budget is spent, without calling the model", async () => {
      reserveServerKeyCall.mockResolvedValue({ allowed: false, release });

      const res = await POST(req());

      expect(res.status).toBe(503);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("hands the slot back when it refuses, so denied requests can't drain the budget", async () => {
      release.mockClear();
      reserveServerKeyCall.mockResolvedValue({ allowed: false, release });

      await POST(req());

      expect(release).toHaveBeenCalled();
    });

    it("never charges the budget for a BYOK call, which spends the user's own key", async () => {
      getUserOverride.mockResolvedValue({ provider: "anthropic", apiKey: "sk-test" });
      reserveServerKeyCall.mockResolvedValue({ allowed: false, release });

      const res = await POST(req());

      expect(reserveServerKeyCall).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("applies to admins too, since it caps spend rather than rationing users", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: true } };
      reserveServerKeyCall.mockResolvedValue({ allowed: false, release });

      const res = await POST(req());

      expect(res.status).toBe(503);
    });

    it("hands the slot back when the model call fails, so a failed turn costs nothing", async () => {
      release.mockClear();
      reserveServerKeyCall.mockResolvedValue({ allowed: true, release });
      chatCompleteStream.mockImplementation(async function* () {
        throw new Error("provider down");
      });

      const body = await readSse(await POST(req()));

      expect(body).toContain("event: error");
      expect(release).toHaveBeenCalled();
    });

    it("proceeds normally when Redis is unavailable, rather than blocking chat", async () => {
      reserveServerKeyCall.mockResolvedValue(null);

      const res = await POST(req());

      expect(res.status).toBe(200);
    });
  });

  describe("long-running transcripts (QA finding F-1)", () => {
    // Alternating roles, ending on a user turn — the shape the client actually
    // posts. 81 entries is far past the old hard cap of 50.
    const longTranscript = Array.from({ length: 81 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Nachricht ${i}`,
    }));

    it("accepts a transcript far past the cap instead of 400ing forever", async () => {
      const res = await POST(req({ mode: "general", messages: longTranscript }));

      expect(res.status).toBe(200);
      expect(chatCompleteStream).toHaveBeenCalled();
    });

    it("forwards only the newest turns to the model, keeping the current one last", async () => {
      await POST(req({ mode: "general", messages: longTranscript }));

      const sent = chatCompleteStream.mock.calls[0][0] as { messages: { content: string }[] };
      expect(sent.messages).toHaveLength(12); // CHAT_HISTORY_LIMIT
      expect(sent.messages.at(-1)?.content).toBe("Nachricht 80");
    });

    it("still rejects an empty transcript", async () => {
      const res = await POST(req({ mode: "general", messages: [] }));
      expect(res.status).toBe(400);
    });
  });

  describe("long assistant replies (QA finding F-2)", () => {
    it("accepts a replayed reply far longer than a user message may be", async () => {
      // ~24k characters is what DEFAULT_MAX_OUTPUT_TOKENS (6144) actually
      // produces — the shape of a good, complete prompt, and three times the
      // user ceiling that used to be applied to it as well.
      const res = await POST(
        req({
          mode: "general",
          messages: [
            { role: "user", content: "Baue mir eine Todo-App" },
            { role: "assistant", content: "P".repeat(24_000) },
            { role: "user", content: "Mach ihn kürzer" },
          ],
        })
      );

      expect(res.status).toBe(200);
      expect(chatCompleteStream).toHaveBeenCalled();
    });

    it("clamps a stored reply that is over even the assistant ceiling instead of 400ing", async () => {
      const res = await POST(
        req({
          mode: "general",
          messages: [
            { role: "user", content: "Baue mir eine Todo-App" },
            { role: "assistant", content: "P".repeat(60_000) },
            { role: "user", content: "Mach ihn kürzer" },
          ],
        })
      );

      expect(res.status).toBe(200);
      const sent = chatCompleteStream.mock.calls[0][0] as { messages: { content: string }[] };
      const replayed = sent.messages.find((m) => m.content.startsWith("P"));
      expect(replayed?.content.length).toBe(40_000);
    });

    it("still rejects an over-long user message, with a German detail", async () => {
      const res = await POST(
        req({ mode: "general", messages: [{ role: "user", content: "x".repeat(8_001) }] })
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as { detail: string };
      expect(json.detail).toContain("zu lang");
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });
  });

  // QA finding F-4: Anthropic rejects a transcript with two user turns in a
  // row outright, so one network blip used to make every following turn fail
  // for BYOK-Anthropic users. Z.ai and OpenAI tolerate it, which is why it
  // stayed invisible on the default provider.
  describe("consecutive same-role turns (QA finding F-4)", () => {
    it("merges consecutive user turns before they reach the provider", async () => {
      await POST(
        req({
          mode: "general",
          messages: [
            { role: "user", content: "Erste Nachricht" },
            { role: "user", content: "Zweite Nachricht" },
          ],
        })
      );

      const sent = chatCompleteStream.mock.calls[0][0] as {
        messages: { role: string; content: string }[];
      };
      expect(sent.messages).toHaveLength(1);
      expect(sent.messages[0].content).toBe("Erste Nachricht\n\nZweite Nachricht");
    });

    it("hands every provider a strictly alternating transcript", async () => {
      await POST(
        req({
          mode: "general",
          messages: [
            { role: "user", content: "a" },
            { role: "user", content: "b" },
            { role: "assistant", content: "c" },
            { role: "assistant", content: "d" },
            { role: "user", content: "e" },
          ],
        })
      );

      const sent = chatCompleteStream.mock.calls[0][0] as { messages: { role: string }[] };
      const roles = sent.messages.map((m) => m.role);
      expect(roles).toEqual(["user", "assistant", "user"]);
    });

    it("leaves an already-alternating transcript untouched", async () => {
      await POST(
        req({
          mode: "general",
          messages: [
            { role: "user", content: "a" },
            { role: "assistant", content: "b" },
            { role: "user", content: "c" },
          ],
        })
      );

      const sent = chatCompleteStream.mock.calls[0][0] as { messages: { content: string }[] };
      expect(sent.messages.map((m) => m.content)).toEqual(["a", "b", "c"]);
    });
  });

  describe("input validation", () => {
    it("rejects a malformed body with 400 before touching auth", async () => {
      const res = await POST(
        new Request("https://promptprinter.app/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not json",
        })
      );

      expect(res.status).toBe(400);
      expect(getUser).not.toHaveBeenCalled();
    });

    it("rejects a request that fails the schema with 400", async () => {
      const res = await POST(req({ mode: "general", messages: [] }));

      expect(res.status).toBe(400);
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });
  });
});

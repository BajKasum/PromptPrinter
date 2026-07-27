import { beforeEach, describe, expect, it, vi } from "vitest";
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

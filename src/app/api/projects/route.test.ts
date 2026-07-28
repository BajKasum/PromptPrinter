import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// QA finding C-6. This route enforces the plan's project cap and the admin
// exemption — both things that quietly stop working if nobody checks them.

const getUser = vi.fn();
const rateLimit = vi.fn();
const insert = vi.fn();

const tableResults: Record<string, { data?: unknown; error?: unknown; count?: number }> = {};

function builder(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null, count: 0 };
  const chain: Record<string, unknown> = {
    maybeSingle: async () => result(),
    single: async () => (table === "projects" ? insert() : result()),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const m of ["select", "eq", "insert", "order", "limit"]) chain[m] = () => chain;
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: (t: string) => builder(t) }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "u:user-1",
}));

function req(body: unknown = { name: "Mein Projekt" }) {
  return new Request("https://promptprinter.app/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 });
    insert.mockResolvedValue({ data: { id: "proj-1" }, error: null });
    tableResults.profiles = { data: { plan: "free", is_admin: false } };
    tableResults.projects = { data: null, error: null, count: 0 };
  });

  it("creates a project and returns its id", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ projectId: "proj-1" });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("rejects a malformed body", async () => {
    const res = await POST(req("not json"));
    expect(res.status).toBe(400);
  });

  it("rejects a name that is too short to be a name", async () => {
    const res = await POST(req({ name: "a" }));
    expect(res.status).toBe(400);
  });

  describe("plan limits", () => {
    it("blocks a free account at its project cap", async () => {
      tableResults.projects = { data: null, error: null, count: 3 };
      const res = await POST(req());
      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("projects");
    });

    it("lets a pro account past the free cap", async () => {
      tableResults.profiles = { data: { plan: "pro", is_admin: false } };
      tableResults.projects = { data: null, error: null, count: 50 };
      const res = await POST(req());
      expect(res.status).toBe(200);
    });

    it("exempts an admin from the cap and the hourly limit alike", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: true } };
      tableResults.projects = { data: null, error: null, count: 99 };
      rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

      const res = await POST(req());

      expect(res.status).toBe(200);
      expect(rateLimit).not.toHaveBeenCalled();
    });

    it("treats an unknown plan value as free rather than as unlimited", async () => {
      tableResults.profiles = { data: { plan: "enterprise", is_admin: false } };
      tableResults.projects = { data: null, error: null, count: 3 };
      const res = await POST(req());
      expect(res.status).toBe(403);
    });
  });

  it("rejects once the hourly rate limit is exceeded", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(req());
    expect(res.status).toBe(429);
  });

  it("reports a failed insert rather than pretending it worked", async () => {
    insert.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await POST(req());
    expect(res.status).toBe(500);
  });
});

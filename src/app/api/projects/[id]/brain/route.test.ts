import { beforeEach, describe, expect, it, vi } from "vitest";

// Die Route ist die Stelle, an der Eigentuemerschaft, Plan-Kontingent,
// Tagesbudget und Ratelimit ueber einem Modellaufruf sitzen — genau die
// Schranken, die stillschweigend aufhoeren zu wirken, wenn niemand sie prueft
// (QA-Befund C-6, derselbe Grund wie bei /api/chat und /api/projects).

const getUser = vi.fn();
const rateLimit = vi.fn();
const reserveMonthlyQuota = vi.fn();
const reserveServerKeyCall = vi.fn();
const getUserOverride = vi.fn();
const llmConfig = vi.fn();
const collectBrainSources = vi.fn();
const analyzeProjectBrain = vi.fn();

/** Was die Tabellen des RLS-gebundenen Clients zurueckgeben. */
const tableResults: Record<string, { data?: unknown; error?: unknown }> = {};
/** Was der Service-Role-Client geschrieben hat. */
const adminWrites: { table: string; op: string; values: Record<string, unknown> }[] = [];
const adminReads: Record<string, { data?: unknown }> = {};

function builder(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {
    maybeSingle: async () => result(),
    single: async () => result(),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  return chain;
}

function adminBuilder(table: string) {
  const chain: Record<string, unknown> = {
    maybeSingle: async () => adminReads[table] ?? { data: null, error: null },
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
  };
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.upsert = (values: Record<string, unknown>) => {
    adminWrites.push({ table, op: "upsert", values });
    return chain;
  };
  chain.update = (values: Record<string, unknown>) => {
    adminWrites.push({ table, op: "update", values });
    return chain;
  };
  chain.delete = () => {
    adminWrites.push({ table, op: "delete", values: {} });
    return chain;
  };
  return chain;
}

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: (t: string) => builder(t) }),
}));
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => adminBuilder(t) }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "u:user-1",
  reserveMonthlyQuota: (...a: unknown[]) => reserveMonthlyQuota(...a),
  reserveServerKeyCall: (...a: unknown[]) => reserveServerKeyCall(...a),
}));
vi.mock("@/server/byok", () => ({ getUserOverride: (...a: unknown[]) => getUserOverride(...a) }));
vi.mock("@/server/llm", () => ({ llmConfig: () => llmConfig() }));
vi.mock("@/features/projects/lib/brain-sources", () => ({
  collectBrainSources: (...a: unknown[]) => collectBrainSources(...a),
}));
vi.mock("@/server/brain/analyze", async () => {
  const actual = await vi.importActual<typeof import("@/server/brain/analyze")>(
    "@/server/brain/analyze"
  );
  return { ...actual, analyzeProjectBrain: (...a: unknown[]) => analyzeProjectBrain(...a) };
});

import { DELETE, POST } from "./route";

const FACTS = {
  summary: "Eine Next.js-App.",
  language: "TypeScript",
  framework: "Next.js 15",
  architecture: "",
  database: "",
  designSystem: "",
  codingStyle: "",
  conventions: [],
  stack: ["Next.js"],
  confidence: "high" as const,
};

const COLLECTED = {
  input: { projectName: "Demo", documents: [{ label: "package.json", text: "{}" }], images: [], repo: null },
  sources: [{ kind: "file" as const, name: "package.json" }],
  digest: "abc12345",
  repoRef: null,
  repoUrl: null,
};

function req(body: unknown = {}) {
  return new Request("https://promptprinter.app/api/projects/proj-1/brain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "proj-1" }) };

describe("POST /api/projects/[id]/brain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminWrites.length = 0;
    for (const key of Object.keys(adminReads)) delete adminReads[key];

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
    reserveMonthlyQuota.mockResolvedValue({ allowed: true, release: vi.fn() });
    reserveServerKeyCall.mockResolvedValue({ allowed: true, release: vi.fn() });
    getUserOverride.mockResolvedValue(null);
    llmConfig.mockReturnValue({ provider: "zai", model: "glm-4.5-air" });
    collectBrainSources.mockResolvedValue(COLLECTED);
    analyzeProjectBrain.mockResolvedValue({ facts: FACTS, model: "glm-4.5-air" });

    tableResults.projects = { data: { name: "Demo" }, error: null };
    tableResults.profiles = { data: { plan: "pro", is_admin: false }, error: null };
  });

  it("analyses and stores the brain", async () => {
    const res = await POST(req(), params);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("ready");
    expect(json.facts.framework).toBe("Next.js 15");
    expect(json.sourceDigest).toBe("abc12345");

    const stored = adminWrites.find((w) => w.op === "update" && w.values.status === "ready");
    expect(stored?.values.facts).toEqual(FACTS);
    expect(stored?.values.model).toBe("glm-4.5-air");
  });

  // Damit ein Reload waehrend des Laufs den Spinner zeigt statt eines
  // scheinbar unveraenderten Leerzustands.
  it("marks the brain as analysing before it starts", async () => {
    await POST(req(), params);
    expect(adminWrites[0]).toMatchObject({ op: "upsert", values: { status: "analyzing" } });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req(), params)).status).toBe(401);
  });

  // Die Schreibzugriffe laufen ueber den Service-Role-Client, fuer den RLS
  // nicht greift — diese Pruefung ist die einzige, die "gehoert dir"
  // feststellt.
  it("404s a project the caller does not own, and writes nothing", async () => {
    tableResults.projects = { data: null, error: null };
    const res = await POST(req(), params);
    expect(res.status).toBe(404);
    expect(adminWrites).toHaveLength(0);
    expect(analyzeProjectBrain).not.toHaveBeenCalled();
  });

  it("never spends a model call on a bad repo url", async () => {
    const res = await POST(req({ repoUrl: "https://evil.com/a/b" }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("repo_invalid_url");
    expect(analyzeProjectBrain).not.toHaveBeenCalled();
    expect(reserveServerKeyCall).not.toHaveBeenCalled();
  });

  it("canonicalises an accepted repo url instead of storing it raw", async () => {
    await POST(req({ repoUrl: "github.com/acme/app/tree/main?x=1" }), params);
    expect(collectBrainSources).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "proj-1",
      expect.objectContaining({ repoUrl: "https://github.com/acme/app" })
    );
  });

  it("keeps the stored repo url when the request does not mention one", async () => {
    adminReads.project_brains = { data: { repo_url: "https://github.com/acme/app" } };
    await POST(req(), params);
    expect(collectBrainSources).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "proj-1",
      expect.objectContaining({ repoUrl: "https://github.com/acme/app" })
    );
  });

  it("clears the stored repo url when the request sends null", async () => {
    adminReads.project_brains = { data: { repo_url: "https://github.com/acme/app" } };
    await POST(req({ repoUrl: null }), params);
    expect(collectBrainSources).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "proj-1",
      expect.objectContaining({ repoUrl: null })
    );
  });

  describe("Kosten-Schranken", () => {
    it("refuses a free account without its own key", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: false }, error: null };
      const res = await POST(req(), params);
      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("byokRequired");
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("lets a free account through on its own key", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: false }, error: null };
      getUserOverride.mockResolvedValue({ provider: "anthropic", apiKey: "sk-x" });
      const res = await POST(req(), params);
      expect(res.status).toBe(200);
      // Und belastet dabei weder Monatskontingent noch Tagesbudget.
      expect(reserveMonthlyQuota).not.toHaveBeenCalled();
      expect(reserveServerKeyCall).not.toHaveBeenCalled();
    });

    it("counts against the same monthly allowance as a chat turn", async () => {
      await POST(req(), params);
      expect(reserveMonthlyQuota).toHaveBeenCalledWith(
        expect.stringMatching(/^chat-quota:user-1:\d{4}-\d{2}$/),
        400
      );
    });

    it("blocks when the monthly allowance is used up", async () => {
      const release = vi.fn();
      reserveMonthlyQuota.mockResolvedValue({ allowed: false, release });
      const res = await POST(req(), params);
      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("chatMessages");
      expect(release).toHaveBeenCalled();
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    // Eine Analyse liest ein ganzes Repo — die teuerste Einzelaktion der App,
    // deshalb ein deutlich knapperes Stundenlimit als der Chat.
    it("has its own, much tighter hourly limit", async () => {
      await POST(req(), params);
      expect(rateLimit).toHaveBeenCalledWith("brain:u:user-1", {
        limit: 5,
        windowMs: 60 * 60 * 1000,
      });
    });

    it("returns 429 when that limit is hit", async () => {
      rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
      expect((await POST(req(), params)).status).toBe(429);
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("exempts an admin from the hourly limit", async () => {
      tableResults.profiles = { data: { plan: "pro", is_admin: true }, error: null };
      const res = await POST(req(), params);
      expect(res.status).toBe(200);
      expect(rateLimit).not.toHaveBeenCalled();
    });

    it("stops when the global daily server-key budget is spent", async () => {
      reserveServerKeyCall.mockResolvedValue({ allowed: false, release: vi.fn() });
      expect((await POST(req(), params)).status).toBe(503);
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    // Anders als der Chat gibt es hier bewusst KEINEN Stub-Modus: eine
    // erfundene Faktenliste waere schlimmer als gar keine, weil sie danach in
    // jeden Prompt dieses Projekts wandert.
    it("refuses rather than inventing facts when no provider is configured", async () => {
      llmConfig.mockReturnValue(null);
      expect((await POST(req(), params)).status).toBe(503);
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });
  });

  describe("Fehlerbehandlung", () => {
    it("records a stable code and hands the allowance back", async () => {
      const release = vi.fn();
      reserveMonthlyQuota.mockResolvedValue({ allowed: true, release });
      collectBrainSources.mockImplementation(() =>
        Promise.reject(Object.assign(new Error("boom"), { name: "GithubImportError" }))
      );

      const res = await POST(req(), params);
      expect(res.status).toBe(502);
      expect(release).toHaveBeenCalled();

      const failed = adminWrites.find((w) => w.values.status === "failed");
      expect(failed?.values.error_code).toBe("analysis_failed");
    });

    // Security-Audit M-1: der Wortlaut eines Anbieter- oder Postgres-Fehlers
    // darf weder in der Antwort noch in der Datenbank landen.
    it("never leaks the underlying message", async () => {
      analyzeProjectBrain.mockImplementation(() =>
        Promise.reject(new Error("Z.ai 429: rate limit for glm-4.5-air"))
      );
      const res = await POST(req(), params);
      const body = JSON.stringify(await res.json());
      expect(body).not.toContain("glm-4.5-air");
      expect(body).not.toContain("Z.ai");
    });
  });
});

describe("DELETE /api/projects/[id]/brain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminWrites.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    tableResults.projects = { data: { id: "proj-1" }, error: null };
  });

  it("deletes the brain", async () => {
    const res = await DELETE(new Request("https://x/y", { method: "DELETE" }), params);
    expect(res.status).toBe(200);
    expect(adminWrites).toContainEqual({ table: "project_brains", op: "delete", values: {} });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(new Request("https://x/y", { method: "DELETE" }), params);
    expect(res.status).toBe(401);
    expect(adminWrites).toHaveLength(0);
  });

  it("404s a project the caller does not own, and deletes nothing", async () => {
    tableResults.projects = { data: null, error: null };
    const res = await DELETE(new Request("https://x/y", { method: "DELETE" }), params);
    expect(res.status).toBe(404);
    expect(adminWrites).toHaveLength(0);
  });
});

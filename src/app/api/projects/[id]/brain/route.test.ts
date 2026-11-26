import { beforeEach, describe, expect, it, vi } from "vitest";

// Die Route ist die Stelle, an der Eigentümerschaft, Zugang zum Server-Key,
// Tagesbudget und Ratelimit über einem Modellaufruf sitzen — genau die
// Schranken, die stillschweigend aufhören zu wirken, wenn niemand sie prüft
// (derselbe Grund wie bei /api/chat und /api/projects).
//
// Auf den Server-Key darf eine Analyse nur als Admin (shared/lib/plans.ts), einen Gratis-Rahmen bietet sie nicht
// an. Das Konto der Tests ist deshalb ein Admin; was für ein Konto mit eigenem Key gilt (Stundenlimit), setzen
// die Tests mit onOwnKey() selbst.

const getUser = vi.fn();
const rateLimit = vi.fn();
const reserveServerKeyCall = vi.fn();
const getUserOverride = vi.fn();
const llmConfig = vi.fn();
const collectBrainSources = vi.fn();
const analyzeProjectBrain = vi.fn();
/** Das Fehlerprotokoll und die Ereignisse der Route. */
const captureError = vi.fn();
const logEvent = vi.fn();

/** Eine Kennung, wie Postgres sie annimmt. */
const PROJECT_ID = "6b0c3c58-2f0e-4d43-9d8a-2a6f2f1d7e10";

/** Was die Tabellen des RLS-gebundenen Clients zurückgeben. */
const tableResults: Record<string, { data?: unknown; error?: unknown; count?: number }> = {};
/** Was der Service-Role-Client geschrieben hat. */
const adminWrites: { table: string; op: string; values: Record<string, unknown> }[] = [];
const adminReads: Record<string, { data?: unknown; error?: unknown }> = {};
/** Schreibfehler des Service-Role-Clients je Vorgang ("upsert", "update"). */
const adminWriteErrors: Record<string, unknown> = {};

function builder(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {
    maybeSingle: async () => result(),
    single: async () => result(),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const m of ["select", "eq", "gte", "order", "limit"]) chain[m] = () => chain;
  return chain;
}

function adminBuilder(table: string) {
  const chain: Record<string, unknown> = {
    maybeSingle: async () => adminReads[table] ?? { data: null, error: null },
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: null, error: adminWriteErrors[lastOp] ?? null }),
  };
  let lastOp = "";
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.upsert = (values: Record<string, unknown>) => {
    lastOp = "upsert";
    adminWrites.push({ table, op: "upsert", values });
    return chain;
  };
  chain.update = (values: Record<string, unknown>) => {
    lastOp = values.status === "failed" ? "update-failed" : "update";
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
vi.mock("@/server/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security/rate-limit")>();
  return {
    ...actual,
    rateLimit: (...a: unknown[]) => rateLimit(...a),
    rateLimitKey: (_req: Request, scope: string) => `${scope}:u:user-1`,
    reserveServerKeyCall: (...a: unknown[]) => reserveServerKeyCall(...a),
  };
});
vi.mock("@/shared/lib/observability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/observability")>();
  return {
    ...actual,
    captureError: (...a: unknown[]) => captureError(...a),
    logEvent: (...a: unknown[]) => logEvent(...a),
  };
});
vi.mock("@/server/byok", () => ({ getUserOverride: (...a: unknown[]) => getUserOverride(...a) }));
vi.mock("@/server/llm", () => ({ llmConfig: () => llmConfig(), selfHostedEndpointActive: () => false }));
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
import { ZAI_CONSENT_VERSION } from "@/server/consent";

// Ein Konto, das der Übermittlung an Z.ai zugestimmt hat (server/consent.ts): ohne sie antwortet der
// Server-Key-Pfad mit 403 consentRequired. Das Verhalten ohne Zustimmung steht in consent.test.ts und im Abschnitt
// "Zustimmung zur Übermittlung an Z.ai" der Route.
const consented = { zai_consent: { version: ZAI_CONSENT_VERSION, at: "2026-10-17T00:00:00.000Z" } };

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
  return new Request(`https://promptprinter.app/api/projects/${PROJECT_ID}/brain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: PROJECT_ID }) };

/** Eine Kennung, die keine UUID ist, und was Postgres auf sie antwortet, wenn die Route sie weiterreicht. */
const malformed = { params: Promise.resolve({ id: "abc" }) };
const UUID_REJECTED = { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' };

/** Ein Konto ohne Adminrechte mit eigenem Key: läuft auf seinem Konto, mit Stundenlimit, ohne Tagesbudget. */
function onOwnKey() {
  tableResults.profiles = { data: { plan: "free", is_admin: false }, error: null };
  getUserOverride.mockResolvedValue({ provider: "anthropic", apiKey: "sk-x" });
}

describe("POST /api/projects/[id]/brain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminWrites.length = 0;
    for (const key of Object.keys(adminReads)) delete adminReads[key];
    for (const key of Object.keys(adminWriteErrors)) delete adminWriteErrors[key];

    getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: consented } } });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
    reserveServerKeyCall.mockResolvedValue({ allowed: true, release: vi.fn() });
    getUserOverride.mockResolvedValue(null);
    llmConfig.mockReturnValue({ provider: "zai", model: "glm-4.5-air" });
    collectBrainSources.mockResolvedValue(COLLECTED);
    analyzeProjectBrain.mockResolvedValue({ facts: FACTS, model: "glm-4.5-air" });

    tableResults.projects = { data: { name: "Demo" }, error: null };
    tableResults.profiles = { data: { plan: "free", is_admin: true }, error: null };
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

  // Damit ein Reload während des Laufs den Spinner zeigt statt eines
  // scheinbar unveränderten Leerzustands.
  it("marks the brain as analysing before it starts", async () => {
    await POST(req(), params);
    expect(adminWrites[0]).toMatchObject({ op: "upsert", values: { status: "analyzing" } });
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req(), params)).status).toBe(401);
  });

  // Die Schreibzugriffe laufen über den Service-Role-Client, für den RLS
  // nicht greift — diese Prüfung ist die einzige, die "gehört dir"
  // feststellt.
  it("404s a project the caller does not own, and writes nothing", async () => {
    tableResults.projects = { data: null, error: null };
    const res = await POST(req(), params);
    expect(res.status).toBe(404);
    expect(adminWrites).toHaveLength(0);
    expect(analyzeProjectBrain).not.toHaveBeenCalled();
  });

  // Weitergereicht wäre die Kennung ein Lesefehler: 503 und ein Eintrag im Fehlerprotokoll je Aufruf.
  it("antwortet auf eine Kennung, die keine UUID ist, mit 404, vor Anmeldung und Datenbank, ohne Eintrag im Fehlerprotokoll", async () => {
    tableResults.projects = { data: null, error: UUID_REJECTED };
    const res = await POST(req(), malformed);
    expect(res.status).toBe(404);
    expect((await res.json()).detail).toBe("Projekt nicht gefunden.");
    expect(captureError).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(adminWrites).toHaveLength(0);
    expect(reserveServerKeyCall).not.toHaveBeenCalled();
    expect(analyzeProjectBrain).not.toHaveBeenCalled();
  });

  it("never spends a model call on a bad repo url", async () => {
    const res = await POST(req({ repoUrl: "https://evil.com/a/b" }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("repo_invalid_url");
    expect(analyzeProjectBrain).not.toHaveBeenCalled();
    expect(reserveServerKeyCall).not.toHaveBeenCalled();
  });

  it("fragt die Analyse nach der Art des Projekts", async () => {
    tableResults.projects = { data: { name: "Bewerbungen", type: "general" }, error: null };
    await POST(req(), params);
    expect(analyzeProjectBrain).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ kind: "general" }));

    tableResults.projects = { data: { name: "App", type: "software" }, error: null };
    await POST(req(), params);
    expect(analyzeProjectBrain).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ kind: "software" }));
  });

  it("canonicalises an accepted repo url instead of storing it raw", async () => {
    await POST(req({ repoUrl: "github.com/acme/app/tree/main?x=1" }), params);
    expect(collectBrainSources).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      PROJECT_ID,
      expect.objectContaining({ repoUrl: "https://github.com/acme/app" })
    );
  });

  it("keeps the stored repo url when the request does not mention one", async () => {
    adminReads.project_brains = { data: { repo_url: "https://github.com/acme/app" } };
    await POST(req(), params);
    expect(collectBrainSources).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      PROJECT_ID,
      expect.objectContaining({ repoUrl: "https://github.com/acme/app" })
    );
  });

  it("clears the stored repo url when the request sends null", async () => {
    adminReads.project_brains = { data: { repo_url: "https://github.com/acme/app" } };
    await POST(req({ repoUrl: null }), params);
    expect(collectBrainSources).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      PROJECT_ID,
      expect.objectContaining({ repoUrl: null })
    );
  });

  describe("Zustimmung zur Übermittlung an Z.ai (Rechts-Audit R-1)", () => {
    const withoutConsent = (appMetadata: unknown) =>
      getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: appMetadata } } });

    it("verweigert die Analyse auf dem Z.ai-Server-Key ohne Zustimmung, ohne Reservierung und ohne zu lesen", async () => {
      withoutConsent({});

      const res = await POST(req(), params);

      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("consentRequired");
      expect(reserveServerKeyCall).not.toHaveBeenCalled();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(collectBrainSources).not.toHaveBeenCalled();
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("braucht sie mit eigenem Key nicht", async () => {
      withoutConsent({});
      getUserOverride.mockResolvedValue({ provider: "anthropic", apiKey: "k" });

      const res = await POST(req(), params);

      expect(res.status).toBe(200);
    });
  });

  describe("Kosten-Schranken", () => {
    // Die Analyse bietet keinen Gratis-Rahmen an: ohne eigenen Key bleibt einem Konto ohne Adminrechte nur der Key-Weg,
    // vor jeder Reservierung.
    it("refuses an account without its own key", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: false }, error: null };
      const res = await POST(req(), params);
      expect(res.status).toBe(403);
      expect((await res.json()).kind).toBe("byokRequired");
      expect(rateLimit).not.toHaveBeenCalled();
      expect(reserveServerKeyCall).not.toHaveBeenCalled();
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    // Eine Zeile mit plan = 'pro' bleibt in der Datenbank stehen und ist Free (shared/lib/plans.ts).
    it("refuses an old account with plan = 'pro' and without its own key like any other", async () => {
      tableResults.profiles = { data: { plan: "pro", is_admin: false }, error: null };
      const res = await POST(req(), params);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ kind: "byokRequired", plan: "free" });
      expect(reserveServerKeyCall).not.toHaveBeenCalled();
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("refuses when the stored key is unreadable, without falling back to the server key", async () => {
      getUserOverride.mockResolvedValue("unreadable");
      const res = await POST(req(), params);
      expect(res.status).toBe(409);
      expect((await res.json()).kind).toBe("byokUnreadable");
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("lets an account through on its own key", async () => {
      onOwnKey();
      const res = await POST(req(), params);
      expect(res.status).toBe(200);
      // Und belastet dabei das Tagesbudget des Server-Keys nicht.
      expect(reserveServerKeyCall).not.toHaveBeenCalled();
    });

    // #202: ein Lesefehler ist weder "nicht gefunden" noch "kein Treffer".
    it("antwortet 503 statt 404, wenn das Projekt nicht gelesen werden kann", async () => {
      tableResults.projects = { data: null, error: { message: "connection reset" } };
      const res = await POST(req(), params);
      expect(res.status).toBe(503);
      expect(reserveServerKeyCall).not.toHaveBeenCalled();
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("antwortet 503, wenn das gespeicherte Gedächtnis nicht gelesen werden kann (sonst ginge die Repo-Adresse verloren)", async () => {
      adminReads.project_brains = { data: null, error: { message: "connection reset" } };
      const res = await POST(req(), params);
      expect(res.status).toBe(503);
      expect(adminWrites).toEqual([]);
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("startet die bezahlte Analyse nicht und gibt die Reservierung zurück, wenn die Zeile nicht angelegt werden kann", async () => {
      const budgetRelease = vi.fn();
      reserveServerKeyCall.mockResolvedValue({ allowed: true, release: budgetRelease });
      adminWriteErrors.upsert = { message: "write failed" };
      const res = await POST(req(), params);
      expect(res.status).toBe(503);
      expect(collectBrainSources).not.toHaveBeenCalled();
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
      expect(budgetRelease).toHaveBeenCalledTimes(1);
    });

    it("meldet einen Fehler statt eines Ergebnisses, das nach dem Neuladen fehlt, wenn das Speichern scheitert", async () => {
      const release = vi.fn();
      reserveServerKeyCall.mockResolvedValue({ allowed: true, release });
      adminWriteErrors.update = { message: "write failed" };
      const res = await POST(req(), params);
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect((await res.json()).status).not.toBe("ready");
      // Das Modell hat gearbeitet: die Reservierung bleibt, wie im Chat bei persist_failed.
      expect(release).not.toHaveBeenCalled();
      expect(adminWrites.some((w) => w.op === "update" && w.values.status === "failed")).toBe(true);
    });

    // Eine Analyse liest ein ganzes Repo — die teuerste Einzelaktion der App,
    // deshalb ein deutlich knapperes Stundenlimit als der Chat.
    it("has its own, much tighter hourly limit", async () => {
      onOwnKey();
      await POST(req(), params);
      expect(rateLimit).toHaveBeenCalledWith("brain:u:user-1", {
        limit: 5,
        windowMs: 60 * 60 * 1000,
      });
    });

    it("returns 429 when that limit is hit", async () => {
      onOwnKey();
      rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
      expect((await POST(req(), params)).status).toBe(429);
      expect(analyzeProjectBrain).not.toHaveBeenCalled();
    });

    it("exempts an admin from the hourly limit", async () => {
      tableResults.profiles = { data: { plan: "free", is_admin: true }, error: null };
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
    // erfundene Faktenliste wäre schlimmer als gar keine, weil sie danach in
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
      reserveServerKeyCall.mockResolvedValue({ allowed: true, release });
      collectBrainSources.mockImplementation(() =>
        Promise.reject(Object.assign(new Error("boom"), { name: "GithubImportError" }))
      );

      const res = await POST(req(), params);
      expect(res.status).toBe(502);
      expect(release).toHaveBeenCalled();

      const failed = adminWrites.find((w) => w.values.status === "failed");
      expect(failed?.values.error_code).toBe("analysis_failed");
    });

    // Der Wortlaut eines Anbieter- oder Postgres-Fehlers darf weder in der
    // Antwort noch in der Datenbank landen.
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
    getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: consented } } });
    tableResults.projects = { data: { id: PROJECT_ID }, error: null };
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

  it("antwortet auf eine Kennung, die keine UUID ist, mit 404, vor Anmeldung und Datenbank, ohne Eintrag im Fehlerprotokoll", async () => {
    tableResults.projects = { data: null, error: UUID_REJECTED };
    const res = await DELETE(new Request("https://x/y", { method: "DELETE" }), malformed);
    expect(res.status).toBe(404);
    expect((await res.json()).detail).toBe("Projekt nicht gefunden.");
    expect(captureError).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(adminWrites).toHaveLength(0);
  });
});

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Vertrag der Eingabeprüfung (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F, zod 4): was ein Aufrufer von
// POST /api/projects/[id]/brain für jede Eingabe zurückbekommt, Statuscode und die GANZE Antwort. Die Fälle
// stehen in route.validation.cases.json, aufgenommen gegen zod 3.25.76
// (`RECORD_VALIDATION=1 npx vitest run <diese Datei>`). Eine gültige Eingabe kommt bis zur Eigentümerprüfung
// und endet dort mit 404 (das Projekt gehört niemandem): so bleibt der Vertrag auf die Grenze der Prüfung
// beschränkt, ohne Modellaufruf, Kontingent oder Speicher.

const CASES_FILE = fileURLToPath(new URL("./route.validation.cases.json", import.meta.url));
type Case = { name: string; body: unknown; raw?: string; status?: number; response?: unknown };
const recorded: Case[] = JSON.parse(readFileSync(CASES_FILE, "utf8"));

const getUser = vi.fn();
const tableResults: Record<string, { data?: unknown; error?: unknown }> = {};

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

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: (t: string) => builder(t) }),
}));
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => builder("admin") }),
}));
vi.mock("@/server/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security/rate-limit")>();
  return { ...actual, rateLimit: vi.fn(), rateLimitKey: () => "u:user-1", reserveMonthlyQuota: vi.fn(), reserveServerKeyCall: vi.fn() };
});
vi.mock("@/server/byok", () => ({ getUserOverride: vi.fn() }));
vi.mock("@/server/llm", () => ({ llmConfig: () => null }));
vi.mock("@/features/projects/lib/brain-sources", () => ({ collectBrainSources: vi.fn() }));
vi.mock("@/server/brain/analyze", async () => {
  const actual = await vi.importActual<typeof import("@/server/brain/analyze")>("@/server/brain/analyze");
  return { ...actual, analyzeProjectBrain: vi.fn() };
});

import { POST } from "./route";

const params = { params: Promise.resolve({ id: "proj-1" }) };

function request(c: Case) {
  return new Request("https://promptprinter.app/api/projects/proj-1/brain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: c.raw !== undefined ? c.raw : JSON.stringify(c.body),
  });
}

function reset() {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  tableResults.projects = { data: null, error: null }; // gehört niemandem: 404 nach der Eingabeprüfung
}
beforeEach(reset);

describe("POST /api/projects/[id]/brain: Antworten auf Eingaben (Vertrag)", () => {
  if (process.env.RECORD_VALIDATION === "1") {
    it("nimmt die Antworten auf", async () => {
      const out: Case[] = [];
      for (const c of recorded) {
        reset();
        const res = await POST(request(c), params);
        out.push({ name: c.name, body: c.body, ...(c.raw !== undefined ? { raw: c.raw } : {}), status: res.status, response: await res.json() });
      }
      writeFileSync(CASES_FILE, JSON.stringify(out, null, 2) + "\n");
    });
    return;
  }

  for (const c of recorded) {
    it(c.name, async () => {
      const res = await POST(request(c), params);
      expect(res.status).toBe(c.status);
      expect(await res.json()).toEqual(c.response);
    });
  }

  it("hat Fälle (der Vertrag ist nicht leer)", () => {
    expect(recorded.length).toBeGreaterThanOrEqual(15);
  });
});

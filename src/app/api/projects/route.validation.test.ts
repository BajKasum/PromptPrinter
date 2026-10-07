import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Vertrag der Eingabeprüfung (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F, zod 4): was ein Aufrufer von
// POST /api/projects für jede Eingabe zurückbekommt, Statuscode und die GANZE Antwort (Fehlertext, Feldpfade,
// Meldungen von zod). Die Fälle stehen in route.validation.cases.json. Sie wurden gegen zod 3.25.76 aufgenommen
// (`RECORD_VALIDATION=1 npx vitest run <diese Datei>`), die Prüfung läuft gegen jede Version: ein Update von zod
// darf an keinem dieser Texte etwas ändern.

const CASES_FILE = fileURLToPath(new URL("./route.validation.cases.json", import.meta.url));
type Case = { name: string; body: unknown; raw?: string; status?: number; response?: unknown };
const recorded: Case[] = JSON.parse(readFileSync(CASES_FILE, "utf8"));

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

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: (t: string) => builder(t) }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "u:user-1",
}));

function request(c: Case) {
  return new Request("https://promptprinter.app/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: c.raw !== undefined ? c.raw : JSON.stringify(c.body),
  });
}

function reset() {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  rateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 });
  insert.mockResolvedValue({ data: { id: "proj-1" }, error: null });
  tableResults.profiles = { data: { plan: "free", is_admin: false } };
  tableResults.projects = { data: null, error: null, count: 0 };
}
beforeEach(reset);

describe("POST /api/projects: Antworten auf Eingaben (Vertrag)", () => {
  if (process.env.RECORD_VALIDATION === "1") {
    it("nimmt die Antworten auf", async () => {
      const out: Case[] = [];
      for (const c of recorded) {
        reset();
        const res = await POST(request(c));
        out.push({ name: c.name, body: c.body, ...(c.raw !== undefined ? { raw: c.raw } : {}), status: res.status, response: await res.json() });
      }
      writeFileSync(CASES_FILE, JSON.stringify(out, null, 2) + "\n");
    });
    return;
  }

  for (const c of recorded) {
    it(c.name, async () => {
      const res = await POST(request(c));
      expect(res.status).toBe(c.status);
      expect(await res.json()).toEqual(c.response);
    });
  }

  it("hat Fälle (der Vertrag ist nicht leer)", () => {
    expect(recorded.length).toBeGreaterThanOrEqual(15);
  });
});


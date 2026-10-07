import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH, POST } from "./route";

// Vertrag der Eingabeprüfung (Betriebs-Audit, Folgesitzung 2026-10-07, Teil F, zod 4): was ein Aufrufer von
// POST und PATCH /api/settings/api-key für jede Eingabe zurückbekommt, Statuscode und die GANZE Antwort
// (Feldpfade und Meldungen von zod). Die Fälle stehen in route.validation.cases.json, aufgenommen gegen zod
// 3.25.76 (`RECORD_VALIDATION=1 npx vitest run <diese Datei>`). Auch die Strenge von `.url()` ist hier
// festgehalten, und das Verhalten der Vereinigung aus Primär- und custom-Zweig (`.strict()`).

const CASES_FILE = fileURLToPath(new URL("./route.validation.cases.json", import.meta.url));
type Case = { name: string; method: "POST" | "PATCH"; body: unknown; raw?: string; status?: number; response?: unknown };
const recorded: Case[] = JSON.parse(readFileSync(CASES_FILE, "utf8"));

const getUser = vi.fn();
const rateLimit = vi.fn();
const chatComplete = vi.fn();
const encrypt = vi.fn();
const upsert = vi.fn();
const rpc = vi.fn();
const tableResults: Record<string, { data?: unknown; error?: unknown }> = {};

function builder(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {
    maybeSingle: async () => result(),
    upsert: (row: unknown, opts: unknown) => upsert(row, opts),
    delete: () => chain,
    then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
  };
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  return chain;
}

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (t: string) => builder(t),
    rpc: (fn: string, args: unknown) => rpc(fn, args),
  }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "u:user-1",
}));
vi.mock("@/server/llm", () => ({ chatComplete: (...a: unknown[]) => chatComplete(...a) }));
vi.mock("@/server/security/crypto", () => ({ encrypt: (v: string) => encrypt(v) }));

function request(c: Case) {
  return new Request("https://promptprinter.app/api/settings/api-key", {
    method: c.method,
    headers: { "content-type": "application/json" },
    body: c.raw !== undefined ? c.raw : JSON.stringify(c.body),
  });
}

function reset(method: "POST" | "PATCH") {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  rateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 });
  chatComplete.mockResolvedValue({ text: "OK", usage: null });
  encrypt.mockReturnValue("ENCRYPTED_BLOB");
  upsert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
  tableResults.profiles = { data: { is_admin: false } };
  // POST: noch kein aktiver Key (der erste Key aktiviert sich selbst). PATCH: der Anbieter ist gespeichert.
  tableResults.user_api_keys = { data: method === "PATCH" ? { provider: "gespeichert" } : null };
}

const run = (c: Case) => (c.method === "PATCH" ? PATCH(request(c)) : POST(request(c)));
beforeEach(() => reset("POST"));

describe("/api/settings/api-key: Antworten auf Eingaben (Vertrag)", () => {
  if (process.env.RECORD_VALIDATION === "1") {
    it("nimmt die Antworten auf", async () => {
      const out: Case[] = [];
      for (const c of recorded) {
        reset(c.method);
        const res = await run(c);
        out.push({ name: c.name, method: c.method, body: c.body, ...(c.raw !== undefined ? { raw: c.raw } : {}), status: res.status, response: await res.json() });
      }
      writeFileSync(CASES_FILE, JSON.stringify(out, null, 2) + "\n");
    });
    return;
  }

  for (const c of recorded) {
    it(c.name, async () => {
      reset(c.method);
      const res = await run(c);
      expect(res.status).toBe(c.status);
      expect(await res.json()).toEqual(c.response);
    });
  }

  it("hat Fälle (der Vertrag ist nicht leer)", () => {
    expect(recorded.length).toBeGreaterThanOrEqual(75);
  });
});

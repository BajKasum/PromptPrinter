import { beforeEach, describe, expect, it, vi } from "vitest";
import { de } from "@/shared/i18n/messages/de";
import { DELETE, PATCH, POST } from "./route";

// Wer Keys verwalten darf, und wie oft, steht je Methode gleich: Sitzung, zweiter Faktor, Stundenlimit mit Ausnahme
// für Admins. Diese Matrix hält es für alle drei fest.

const getUser = vi.fn();
const getClaims = vi.fn();
const rateLimit = vi.fn();
const chatComplete = vi.fn();
const write = vi.fn();
let profile: { data: unknown; error: unknown };
const reads: string[] = [];

function builder(table: string) {
  const chain: Record<string, unknown> = {
    maybeSingle: async () => {
      reads.push(table);
      return table === "profiles" ? profile : { data: { provider: "openai" }, error: null };
    },
    upsert: async () => (write("upsert"), { error: null }),
    delete: () => (write("delete"), chain),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: [{ provider: "openai" }], error: null }),
  };
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  return chain;
}

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, getClaims }, from: (t: string) => builder(t) }),
}));
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => builder(t),
    rpc: async () => (write("rpc"), { error: null }),
  }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: (_req: Request, scope: string) => scope,
}));
vi.mock("@/server/llm", () => ({ chatComplete: (...a: unknown[]) => chatComplete(...a) }));
vi.mock("@/server/security/security-events", () => ({ recordSecurityEvent: vi.fn() }));
vi.mock("@/server/security/crypto", () => ({ encrypt: () => "encrypted", decrypt: vi.fn() }));

const URL = "https://promptprinter.app/api/settings/api-key";
const json = (method: string, body: unknown) =>
  new Request(URL, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const METHODS = [
  {
    method: "POST",
    call: () => POST(json("POST", { apiKey: "sk-ant-secret" })),
    limit: ["api-key-save", 30],
    readFailed: de.api.keySaveFailed,
  },
  {
    method: "PATCH",
    call: () => PATCH(json("PATCH", { provider: "openai" })),
    limit: ["api-key-update", 60],
    readFailed: de.api.keyActivateFailed,
  },
  {
    method: "DELETE",
    call: () => DELETE(new Request(`${URL}?provider=openai`, { method: "DELETE" })),
    limit: ["api-key-delete", 60],
    readFailed: de.api.keyRemoveFailed,
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  reads.length = 0;
  profile = { data: { is_admin: false }, error: null };
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getClaims.mockResolvedValue({ data: { claims: { aal: "aal1" } } });
  rateLimit.mockResolvedValue({ allowed: true, remaining: 1, resetAt: Date.now() + 1000 });
  chatComplete.mockResolvedValue({ text: "OK", usage: null });
});

/** Nichts gelesen, nichts geschrieben, kein Anbieter gefragt und kein Zähler verbraucht. */
function expectUntouched() {
  expect(reads).toEqual([]);
  expect(write).not.toHaveBeenCalled();
  expect(chatComplete).not.toHaveBeenCalled();
  expect(rateLimit).not.toHaveBeenCalled();
}

describe.each(METHODS)("$method /api/settings/api-key: Zugang", ({ call, limit, readFailed }) => {
  it("ohne Sitzung 401, ohne etwas anzufassen", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await call();
    expect(res.status).toBe(401);
    expectUntouched();
  });

  it("ohne zweiten Faktor 403 aal2_required, ohne etwas anzufassen", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", factors: [{ status: "verified" }] } } });
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("aal2_required");
    expectUntouched();
  });

  it("zählt gegen den eigenen Bereich und darf mit Platz weiter", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(rateLimit.mock.calls).toEqual([[limit[0], { limit: limit[1], windowMs: 60 * 60 * 1000 }]]);
  });

  it("über dem Stundenlimit 429, ohne zu schreiben", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await call();
    expect(res.status).toBe(429);
    const body = (await res.json()) as { detail: string; kind: string; retryAfter: number };
    expect(body).toMatchObject({ detail: de.api.tooManyRequests, kind: "rate_limited" });
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(res.headers.get("retry-after")).toBe(String(body.retryAfter));
    expect(write).not.toHaveBeenCalled();
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it("nimmt Admins vom Stundenlimit aus", async () => {
    profile = { data: { is_admin: true }, error: null };
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await call();
    expect(res.status).toBe(200);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("antwortet 503 mit dem Satz der Methode, wenn sich das Profil nicht lesen lässt", async () => {
    profile = { data: null, error: { message: "db down" } };
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).detail).toBe(readFailed);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});

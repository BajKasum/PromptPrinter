import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH, POST } from "./route";

// Ein Lesefehler ist kein "kein Treffer": kein Admin, kein aktiver Key und kein gespeicherter Key wären hier jeweils
// eine falsche Entscheidung. Die Route antwortet 503 und schreibt nichts.

const captureError = vi.fn();
const upsert = vi.fn();
const rpc = vi.fn();
const deleteRow = vi.fn();
const tables: Record<string, { data: unknown; error: unknown }> = {};

function builder(table: string) {
  const chain: Record<string, unknown> = {
    maybeSingle: async () => tables[table] ?? { data: null, error: null },
    upsert: (...a: unknown[]) => upsert(...a),
    delete: () => chain,
    then: (resolve: (v: unknown) => unknown) => resolve(deleteRow()),
  };
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  return chain;
}

vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()), captureError: (...a: unknown[]) => captureError(...a) }));
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (t: string) => builder(t),
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));
// Geschrieben wird mit dem Service-Role-Schlüssel (server/byok.ts), hier auf dieselben Attrappen gelenkt.
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => builder(t), rpc: (...a: unknown[]) => rpc(...a) }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: async () => ({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 }),
  rateLimitKey: () => "u:user-1",
}));
vi.mock("@/server/llm", () => ({ chatComplete: async () => "ok" }));
vi.mock("@/server/security/security-events", () => ({ recordSecurityEvent: vi.fn() }));
vi.mock("@/server/security/crypto", () => ({ encrypt: () => "encrypted", decrypt: vi.fn() }));

const URL = "https://promptprinter.app/api/settings/api-key";
const send = (method: string, body: unknown) =>
  new Request(URL, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const failure = { data: null, error: { message: "db down" } };

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(tables)) delete tables[key];
  upsert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
  deleteRow.mockReturnValue({ error: null });
});

describe("api-key: Lesefehler", () => {
  it("POST: das Profil nicht lesbar ergibt 503, gespeichert wird nichts", async () => {
    tables.profiles = failure;
    const res = await POST(send("POST", { apiKey: "sk-ant-abcdefghijklmnopqrstuvwxyz" }));
    expect(res.status).toBe(503);
    expect(upsert).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith("api_key.profile_read_failed", failure.error, expect.anything());
  });

  it("POST: der aktive Key nicht lesbar nimmt keinem anderen Key den Platz", async () => {
    tables.user_api_keys = failure;
    const res = await POST(send("POST", { apiKey: "sk-ant-abcdefghijklmnopqrstuvwxyz" }));
    expect(res.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith("api_key.active_read_failed", failure.error, expect.anything());
  });

  it("PATCH: das Profil nicht lesbar ergibt 503", async () => {
    tables.profiles = failure;
    const res = await PATCH(send("PATCH", { provider: "anthropic" }));
    expect(res.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("PATCH: ein Lesefehler beim gespeicherten Key ist kein 404", async () => {
    tables.user_api_keys = failure;
    const res = await PATCH(send("PATCH", { provider: "anthropic" }));
    expect(res.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith("api_key.existing_read_failed", failure.error, expect.anything());
  });

  it("DELETE: das Profil nicht lesbar ergibt 503, gelöscht wird nichts", async () => {
    tables.profiles = failure;
    const res = await DELETE(new Request(`${URL}?provider=anthropic`, { method: "DELETE" }));
    expect(res.status).toBe(503);
    expect(deleteRow).not.toHaveBeenCalled();
  });
});

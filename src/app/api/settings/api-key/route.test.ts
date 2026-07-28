import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";

// QA finding C-6. This route is where a user's own provider key enters the
// system: it decides what gets encrypted, what gets stored, and whether a bad
// key fails loudly here or silently at the user's next chat turn.

const getUser = vi.fn();
const rateLimit = vi.fn();
const chatComplete = vi.fn();
const encrypt = vi.fn();
const upsert = vi.fn();
const deleteRow = vi.fn();

const tableResults: Record<string, { data?: unknown; error?: unknown }> = {};

function builder(table: string) {
  const result = () => tableResults[table] ?? { data: null, error: null };
  const chain: Record<string, unknown> = {
    maybeSingle: async () => result(),
    upsert: (row: unknown, opts: unknown) => upsert(row, opts),
    delete: () => chain,
    then: (resolve: (v: unknown) => unknown) => resolve(deleteRow()),
  };
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: (t: string) => builder(t) }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "u:user-1",
}));
vi.mock("@/lib/llm", () => ({ chatComplete: (...a: unknown[]) => chatComplete(...a) }));
vi.mock("@/lib/crypto", () => ({ encrypt: (v: string) => encrypt(v) }));

function post(body: unknown) {
  return new Request("https://promptprinter.app/api/settings/api-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function del(provider?: string) {
  const url = provider
    ? `https://promptprinter.app/api/settings/api-key?provider=${provider}`
    : "https://promptprinter.app/api/settings/api-key";
  return new Request(url, { method: "DELETE" });
}

describe("POST /api/settings/api-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 1000 });
    chatComplete.mockResolvedValue({ text: "OK", usage: null });
    // Opaque on purpose: an echoing stub would make the "never in plaintext"
    // assertion below pass for the wrong reason.
    encrypt.mockReturnValue("ENCRYPTED_BLOB");
    upsert.mockResolvedValue({ error: null });
    tableResults.profiles = { data: { is_admin: false } };
  });

  it("stores a named provider's key encrypted, never in plaintext", async () => {
    const res = await POST(post({ provider: "anthropic", apiKey: "sk-ant-secret" }));

    expect(res.status).toBe(200);
    expect(encrypt).toHaveBeenCalledWith("sk-ant-secret");
    const [row] = upsert.mock.calls[0];
    expect(row).toMatchObject({ provider: "anthropic", encrypted_key: "ENCRYPTED_BLOB" });
    expect(JSON.stringify(row)).not.toContain("sk-ant-secret");
  });

  it("nulls the custom-only columns for a named provider", async () => {
    await POST(post({ provider: "openai", apiKey: "sk-x" }));
    expect(upsert.mock.calls[0][0]).toMatchObject({ label: null, base_url: null, model: null });
  });

  it("stores endpoint and model for a custom provider", async () => {
    await POST(
      post({
        provider: "custom",
        apiKey: "k",
        label: "Mein Gateway",
        baseUrl: "https://api.example.com/v1/chat/completions",
        model: "some-model",
      })
    );
    expect(upsert.mock.calls[0][0]).toMatchObject({
      provider: "custom",
      label: "Mein Gateway",
      base_url: "https://api.example.com/v1/chat/completions",
      model: "some-model",
    });
  });

  // The whole point of the test call: a typo or a revoked key must fail here,
  // with a message, rather than at the user's next chat turn.
  it("refuses to store a key the provider rejects", async () => {
    chatComplete.mockRejectedValue(new Error("401 invalid_api_key"));

    const res = await POST(post({ provider: "anthropic", apiKey: "sk-wrong" }));

    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("tests the key before storing it, not after", async () => {
    await POST(post({ provider: "anthropic", apiKey: "sk-ok" }));
    expect(chatComplete.mock.invocationCallOrder[0]).toBeLessThan(
      upsert.mock.invocationCallOrder[0]
    );
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(post({ provider: "anthropic", apiKey: "k" }));
    expect(res.status).toBe(401);
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider", async () => {
    const res = await POST(post({ provider: "hackerman", apiKey: "k" }));
    expect(res.status).toBe(400);
  });

  it("rejects a custom provider without its endpoint", async () => {
    const res = await POST(post({ provider: "custom", apiKey: "k", label: "X", model: "m" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-URL endpoint before any request is attempted", async () => {
    const res = await POST(
      post({ provider: "custom", apiKey: "k", label: "X", baseUrl: "nope", model: "m" })
    );
    expect(res.status).toBe(400);
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it("rejects once the hourly rate limit is exceeded", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const res = await POST(post({ provider: "anthropic", apiKey: "k" }));
    expect(res.status).toBe(429);
  });

  it("exempts an admin from the hourly rate limit", async () => {
    tableResults.profiles = { data: { is_admin: true } };
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await POST(post({ provider: "anthropic", apiKey: "k" }));

    expect(res.status).toBe(200);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("reports a failed write rather than pretending the key was saved", async () => {
    upsert.mockResolvedValue({ error: { message: "db down" } });
    const res = await POST(post({ provider: "anthropic", apiKey: "k" }));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/settings/api-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    deleteRow.mockResolvedValue({ error: null });
  });

  it("removes the stored key for a known provider", async () => {
    const res = await DELETE(del("anthropic"));
    expect(res.status).toBe(200);
  });

  it("rejects an unknown provider", async () => {
    const res = await DELETE(del("hackerman"));
    expect(res.status).toBe(400);
  });

  it("rejects a missing provider parameter", async () => {
    const res = await DELETE(del());
    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(del("anthropic"));
    expect(res.status).toBe(401);
  });
});

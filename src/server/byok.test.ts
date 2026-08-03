import { beforeEach, describe, expect, it, vi } from "vitest";

// QA finding C-6: byok.ts decides whether a user's calls run on their own key
// or the server's — and therefore whether the monthly quota applies at all
// (/api/chat skips it entirely when an override exists). It had no test.

const decrypt = vi.fn();
vi.mock("@/server/security/crypto", () => ({ decrypt: (blob: string) => decrypt(blob) }));

type Row = Record<string, unknown> | null;

// Minimal PostgREST-shaped stub: every filter returns the builder, and the
// terminal call resolves to the canned row(s).
function supabaseWith(result: { data: Row | Row[] }) {
  const chain: Record<string, unknown> = {
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  return { from: () => chain } as never;
}

// QA finding S-3: getUserOverride reads encrypted_key through the service-role
// admin client now (the `authenticated` role lost that column's SELECT grant,
// see migration 0020), not the request-scoped client the other two exports
// below still use — so it gets its own stub, swapped in per test via the
// module-level mock rather than passed as an argument.
let adminResult: { data: Row } = { data: null };
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => supabaseWith(adminResult),
}));

const { getConfiguredProviders, getCustomProvider, getUserOverride } = await import("@/server/byok");

describe("getUserOverride", () => {
  beforeEach(() => {
    decrypt.mockReset();
    decrypt.mockImplementation((blob: string) => `plain:${blob}`);
    adminResult = { data: null };
  });

  it("returns null when the user configured no key", async () => {
    adminResult = { data: null };
    expect(await getUserOverride("user-1")).toBeNull();
  });

  it("decrypts a named provider's key", async () => {
    adminResult = { data: { provider: "anthropic", encrypted_key: "blob" } };
    const override = await getUserOverride("user-1");
    expect(override).toEqual({ provider: "anthropic", apiKey: "plain:blob" });
  });

  it("carries endpoint and model for a custom provider", async () => {
    adminResult = {
      data: {
        provider: "custom",
        encrypted_key: "blob",
        base_url: "https://api.example.com/v1/chat/completions",
        model: "some-model",
      },
    };
    const override = await getUserOverride("user-1");
    expect(override).toEqual({
      provider: "custom",
      apiKey: "plain:blob",
      baseUrl: "https://api.example.com/v1/chat/completions",
      model: "some-model",
    });
  });

  // Degrading to "no override" means the request falls back to the server's own
  // provider, which is the safe direction: the alternative is a hard failure on
  // a chat the user can otherwise have.
  it("degrades to null when the stored blob cannot be decrypted", async () => {
    decrypt.mockImplementation(() => {
      throw new Error("bad auth tag");
    });
    adminResult = { data: { provider: "openai", encrypted_key: "tampered" } };
    const override = await getUserOverride("user-1");
    expect(override).toBeNull();
  });

  it("degrades to null on an inconsistent custom row rather than crashing", async () => {
    adminResult = {
      data: { provider: "custom", encrypted_key: "blob", base_url: null, model: null },
    };
    const override = await getUserOverride("user-1");
    expect(override).toBeNull();
  });
});

describe("getConfiguredProviders", () => {
  it("lists what the user has set up", async () => {
    const providers = await getConfiguredProviders(
      supabaseWith({ data: [{ provider: "openai" }, { provider: "custom" }] }),
      "user-1"
    );
    expect(providers).toEqual(["openai", "custom"]);
  });

  it("returns an empty list rather than null when nothing is configured", async () => {
    expect(await getConfiguredProviders(supabaseWith({ data: [] }), "user-1")).toEqual([]);
  });
});

describe("getCustomProvider", () => {
  it("returns the endpoint metadata for the settings UI, never the key", async () => {
    const meta = await getCustomProvider(
      supabaseWith({
        data: { label: "Mein Gateway", base_url: "https://api.example.com", model: "m" },
      }),
      "user-1"
    );
    expect(meta).toEqual({
      label: "Mein Gateway",
      baseUrl: "https://api.example.com",
      model: "m",
    });
    expect(JSON.stringify(meta)).not.toContain("encrypted");
  });

  it("returns null when the row is incomplete", async () => {
    const meta = await getCustomProvider(
      supabaseWith({ data: { label: "X", base_url: null, model: "m" } }),
      "user-1"
    );
    expect(meta).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// QA finding C-6: byok.ts decides whether a user's calls run on their own key
// or the server's — and therefore whether the monthly quota applies at all
// (/api/chat skips it entirely when an override exists). It had no test.

const decrypt = vi.fn();
vi.mock("@/lib/crypto", () => ({ decrypt: (blob: string) => decrypt(blob) }));

const { getConfiguredProviders, getCustomProvider, getUserOverride } = await import("@/lib/byok");

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

describe("getUserOverride", () => {
  beforeEach(() => {
    decrypt.mockReset();
    decrypt.mockImplementation((blob: string) => `plain:${blob}`);
  });

  it("returns null when the user configured no key", async () => {
    expect(await getUserOverride(supabaseWith({ data: null }), "user-1")).toBeNull();
  });

  it("decrypts a named provider's key", async () => {
    const override = await getUserOverride(
      supabaseWith({ data: { provider: "anthropic", encrypted_key: "blob" } }),
      "user-1"
    );
    expect(override).toEqual({ provider: "anthropic", apiKey: "plain:blob" });
  });

  it("carries endpoint and model for a custom provider", async () => {
    const override = await getUserOverride(
      supabaseWith({
        data: {
          provider: "custom",
          encrypted_key: "blob",
          base_url: "https://api.example.com/v1/chat/completions",
          model: "some-model",
        },
      }),
      "user-1"
    );
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
    const override = await getUserOverride(
      supabaseWith({ data: { provider: "openai", encrypted_key: "tampered" } }),
      "user-1"
    );
    expect(override).toBeNull();
  });

  it("degrades to null on an inconsistent custom row rather than crashing", async () => {
    const override = await getUserOverride(
      supabaseWith({
        data: { provider: "custom", encrypted_key: "blob", base_url: null, model: null },
      }),
      "user-1"
    );
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

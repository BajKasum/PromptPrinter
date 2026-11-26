import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// QA finding C-6: byok.ts decides whether a user's calls run on their own key
// or the server's — and therefore whether the free trial and the daily budget
// apply at all (/api/chat skips both when an override exists). It had no test.

const decrypt = vi.fn();
vi.mock("@/server/security/crypto", () => ({
  decrypt: (blob: string, binding: unknown) => decrypt(blob, binding),
}));
const captureError = vi.fn();
vi.mock("@/shared/lib/observability", () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}));

type Row = Record<string, unknown> | null;

// Minimal PostgREST-shaped stub: every filter returns the builder, and the
// terminal call resolves to the canned row(s).
function supabaseWith(result: { data: Row | Row[]; error?: { message: string } }) {
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
let adminResult: { data: Row; error?: { message: string } } = { data: null };
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => supabaseWith(adminResult),
}));

const { getByokOverview, getConfiguredProviders, getUserOverride } = await import("@/server/byok");

describe("getUserOverride", () => {
  beforeEach(() => {
    decrypt.mockReset();
    captureError.mockReset();
    decrypt.mockImplementation((blob: string) => `plain:${blob}`);
    adminResult = { data: null };
  });

  it("returns null when the user configured no key", async () => {
    adminResult = { data: null };
    expect(await getUserOverride("user-1")).toBeNull();
  });

  // #202: ein Lesefehler ist NICHT "kein eigener Key": der Zug liefe sonst auf dem Server-Key, Kosten beim Betreiber.
  it("throws instead of returning null when the read fails", async () => {
    adminResult = { data: null, error: { message: "connection reset" } };
    await expect(getUserOverride("user-1")).rejects.toThrow("database read failed: user_api_keys");
    await expect(getUserOverride("user-1")).rejects.toMatchObject({ name: "DatabaseReadError" });
  });

  it("decrypts a named provider's key", async () => {
    adminResult = { data: { provider: "anthropic", encrypted_key: "blob" } };
    const override = await getUserOverride("user-1");
    expect(override).toEqual({ provider: "anthropic", apiKey: "plain:blob" });
  });

  it("öffnet den Wert nur für die Zeile, aus der er stammt", async () => {
    adminResult = { data: { provider: "anthropic", encrypted_key: "blob" } };
    await getUserOverride("user-1");
    expect(decrypt).toHaveBeenCalledWith("blob", { userId: "user-1", provider: "anthropic" });
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

  it("meldet einen nicht entschlüsselbaren Key als unreadable, genau einmal und ohne Geheimnis", async () => {
    decrypt.mockImplementation(() => {
      throw new Error("bad auth tag");
    });
    adminResult = { data: { provider: "openai", encrypted_key: "tampered" } };
    expect(await getUserOverride("user-1")).toBe("unreadable");
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith("byok.key_unreadable", expect.any(Error), {
      userId: "user-1",
      provider: "openai",
    });
    expect(JSON.stringify(captureError.mock.calls[0][2])).not.toContain("tampered");
  });

  it("meldet eine widersprüchliche Custom-Zeile als unreadable", async () => {
    adminResult = {
      data: { provider: "custom", encrypted_key: "blob", base_url: null, model: null },
    };
    expect(await getUserOverride("user-1")).toBe("unreadable");
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("ein Key unter einem anderen Secret ist unreadable, nicht \"kein Key\" (echte Verschlüsselung)", async () => {
    const real = await vi.importActual<typeof import("@/server/security/crypto")>("@/server/security/crypto");
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", randomBytes(32).toString("base64"));
    const blob = real.encrypt("sk-geheim", { userId: "user-1", provider: "openai" });
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", randomBytes(32).toString("base64"));
    decrypt.mockImplementation(real.decrypt);
    adminResult = { data: { provider: "openai", encrypted_key: blob } };
    expect(await getUserOverride("user-1")).toBe("unreadable");
    expect(JSON.stringify(captureError.mock.calls)).not.toContain("sk-geheim");
    vi.unstubAllEnvs();
  });

  it("ein Chiffretext aus einer fremden Zeile ist unreadable, auch unter dem richtigen Secret", async () => {
    const real = await vi.importActual<typeof import("@/server/security/crypto")>("@/server/security/crypto");
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", randomBytes(32).toString("base64"));
    const foreign = real.encrypt("sk-fremd", { userId: "user-2", provider: "openai" });
    decrypt.mockImplementation(real.decrypt);
    adminResult = { data: { provider: "openai", encrypted_key: foreign } };
    expect(await getUserOverride("user-1")).toBe("unreadable");
    expect(JSON.stringify(captureError.mock.calls)).not.toContain("sk-fremd");
    vi.unstubAllEnvs();
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

  it("wirft bei einem Lesefehler, statt \"nichts eingerichtet\" zu melden", async () => {
    await expect(
      getConfiguredProviders(supabaseWith({ data: null, error: { message: "db down" } }), "user-1")
    ).rejects.toThrow("database read failed");
  });

  it("returns an empty list rather than null when nothing is configured", async () => {
    expect(await getConfiguredProviders(supabaseWith({ data: [] }), "user-1")).toEqual([]);
  });
});

describe("getByokOverview", () => {
  const row = (provider: string, extra: Record<string, unknown> = {}) => ({
    provider,
    is_active: false,
    label: null,
    base_url: null,
    model: null,
    ...extra,
  });
  const custom = { label: "Mein Gateway", base_url: "https://api.example.com", model: "m" };

  /** Zählt die Abfragen und hält Spalten und Bedingungen fest. */
  function counting(result: { data: Row[] | null; error?: { message: string } }) {
    const calls = { from: [] as string[], select: [] as string[], eq: [] as [string, unknown][] };
    const chain: Record<string, unknown> = {
      select: (columns: string) => {
        calls.select.push(columns);
        return chain;
      },
      eq: (column: string, value: unknown) => {
        calls.eq.push([column, value]);
        return chain;
      },
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    };
    const client = {
      from: (table: string) => {
        calls.from.push(table);
        return chain;
      },
    } as never;
    return { client, calls };
  }

  it("liefert Anbieter, aktiven Key und Endpunkt aus EINER Abfrage, auf das Konto eingegrenzt, ohne Schlüssel", async () => {
    const { client, calls } = counting({ data: [row("openai"), row("custom", { ...custom, is_active: true })] });
    expect(await getByokOverview(client, "user-1")).toEqual({
      configuredProviders: ["openai", "custom"],
      activeProvider: "custom",
      customProvider: { label: "Mein Gateway", baseUrl: "https://api.example.com", model: "m" },
    });
    expect(calls.from).toEqual(["user_api_keys"]);
    expect(calls.eq).toEqual([["user_id", "user-1"]]);
    expect(calls.select).toEqual(["provider, is_active, label, base_url, model"]);
    expect(calls.select.join()).not.toContain("encrypted_key");
  });

  it("meldet ohne Zeilen nichts eingerichtet, ohne aktiven Key und ohne Endpunkt", async () => {
    expect(await getByokOverview(counting({ data: [] }).client, "user-1")).toEqual({
      configuredProviders: [],
      activeProvider: null,
      customProvider: null,
    });
  });

  it("nennt als aktiv nur den Key mit is_active", async () => {
    const { client } = counting({ data: [row("openai"), row("anthropic", { is_active: true })] });
    expect(await getByokOverview(client, "user-1")).toMatchObject({ activeProvider: "anthropic", customProvider: null });
    const none = counting({ data: [row("openai")] });
    expect(await getByokOverview(none.client, "user-1")).toMatchObject({ activeProvider: null });
  });

  it.each(["label", "base_url", "model"])("zeigt einen Endpunkt ohne %s nicht als eingerichtet", async (missing) => {
    const { client } = counting({ data: [row("custom", { ...custom, [missing]: null })] });
    expect(await getByokOverview(client, "user-1")).toMatchObject({
      configuredProviders: ["custom"],
      customProvider: null,
    });
  });

  it("wirft bei einem Lesefehler, statt \"nichts eingerichtet\" zu melden", async () => {
    const { client } = counting({ data: null, error: { message: "db down" } });
    await expect(getByokOverview(client, "user-1")).rejects.toThrow("database read failed: user_api_keys");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const tables: Record<string, { data: unknown; error: unknown }> = {};
const eq = vi.fn();
const createClientForRequest = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createClientForRequest: (...a: unknown[]) => createClientForRequest(...a),
}));

const llmConfig = vi.fn();
vi.mock("@/server/llm", () => ({ llmConfig: () => llmConfig() }));

const rateLimit = vi.fn();
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: () => "key",
}));

import { ZAI_CONSENT_VERSION } from "@/server/consent";
import { GET } from "./route";

function client() {
  return {
    auth: { getUser },
    from: (table: string) => {
      const result = tables[table];
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          eq(table, column, value);
          return chain;
        },
        limit: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
  };
}

function get(authorization?: string) {
  return new Request("https://promptprinter.app/api/cli/me", {
    headers: { "x-forwarded-for": "192.0.2.60", ...(authorization ? { authorization } : {}) },
  });
}

const CONSENT = { zai_consent: { version: ZAI_CONSENT_VERSION, at: "2026-11-02T00:00:00Z" } };

function signedIn(appMetadata: unknown = {}) {
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "du@beispiel.ch", app_metadata: appMetadata } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 1000 });
  createClientForRequest.mockResolvedValue(client());
  llmConfig.mockReturnValue({ provider: "zai" });
  tables.profiles = { data: { plan: "free", is_admin: false }, error: null };
  tables.user_api_keys = { data: [], error: null };
  signedIn();
});

describe("GET /api/cli/me", () => {
  it("Free ohne Key: der Key fehlt, die Zustimmung spielt noch keine Rolle", async () => {
    const res = await GET(get("Bearer tok"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      email: "du@beispiel.ch",
      plan: "free",
      hasOwnKey: false,
      needsOwnKey: true,
      needsConsent: false,
    });
  });

  it("Free mit Key: alles da, der eigene Key geht nie an Z.ai und braucht keine Zustimmung", async () => {
    tables.user_api_keys = { data: [{ provider: "gemini" }], error: null };
    expect(await (await GET(get("Bearer tok"))).json()).toMatchObject({
      hasOwnKey: true,
      needsOwnKey: false,
      needsConsent: false,
    });
  });

  it("Pro ohne Key auf Z.ai braucht die Zustimmung, mit ihr nicht mehr", async () => {
    tables.profiles = { data: { plan: "pro", is_admin: false }, error: null };
    expect(await (await GET(get("Bearer tok"))).json()).toMatchObject({
      plan: "pro",
      needsOwnKey: false,
      needsConsent: true,
    });
    signedIn(CONSENT);
    expect((await (await GET(get("Bearer tok"))).json()).needsConsent).toBe(false);
  });

  it("Pro auf einem anderen Anbieter als Z.ai braucht keine Zustimmung", async () => {
    tables.profiles = { data: { plan: "pro", is_admin: false }, error: null };
    llmConfig.mockReturnValue({ provider: "gemini" });
    expect((await (await GET(get("Bearer tok"))).json()).needsConsent).toBe(false);
  });

  it("ein Admin auf Free braucht keinen eigenen Key", async () => {
    tables.profiles = { data: { plan: "free", is_admin: true }, error: null };
    expect((await (await GET(get("Bearer tok"))).json()).needsOwnKey).toBe(false);
  });

  it("fragt beide Tabellen ausdrücklich nach dem eigenen Konto (zweite Linie neben RLS)", async () => {
    await GET(get("Bearer tok"));
    expect(eq).toHaveBeenCalledWith("profiles", "id", "u1");
    expect(eq).toHaveBeenCalledWith("user_api_keys", "user_id", "u1");
  });

  it("verrät den Key nicht: die Antwort nennt keinen Anbieter und keinen Schlüssel", async () => {
    tables.user_api_keys = { data: [{ provider: "anthropic", encrypted_key: "geheim" }], error: null };
    const text = await (await GET(get("Bearer tok"))).text();
    expect(text).not.toContain("anthropic");
    expect(text).not.toContain("geheim");
  });

  it("ohne Bearer-Kopf oder mit fremdem Schema 401, auch mit Cookie, ohne den Auth-Server zu fragen", async () => {
    for (const header of [undefined, "Basic abc"]) {
      const res = await GET(get(header));
      expect(res.status, String(header)).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(createClientForRequest).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("ein ungültiges Token oder ein gelöschtes Konto ergibt 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(get("Bearer tot"));
    expect(res.status).toBe(401);
    expect((await res.json()).kind).toBe("unauthorized");
  });

  it("ein Lesefehler ist nicht 'Free ohne Key', sondern 503", async () => {
    tables.profiles = { data: null, error: { message: "kaputt" } };
    const res = await GET(get("Bearer tok"));
    expect(res.status).toBe(503);
    expect((await res.json()).kind).toBe("unavailable");
  });

  it("das Ratenlimit greift vor dem Auth-Server und nennt die Wartezeit", async () => {
    rateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 30_000 });
    const res = await GET(get("Bearer tok"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.kind).toBe("rate_limited");
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(getUser).not.toHaveBeenCalled();
  });
});

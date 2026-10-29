import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Bearer-Weg der Kommandozeile (createClientForRequest), gegen die echte supabase-js-Bibliothek und
// ein ersetztes fetch: belegt, dass `auth.getUser()` mit einem Client OHNE Sitzung das Token aus dem Kopf
// an /auth/v1/user schickt (hasCustomAuthorizationHeader), dass der Header die Cookies ausschaltet, und
// dass ohne Header alles wie vorher über die Cookies läuft.

const cookieStore = {
  getAll: vi.fn(() => [{ name: "sb-x-auth-token", value: "base64-cookie" }]),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    const authorization = new Headers(init?.headers).get("authorization");
    if (authorization !== "Bearer good-token") {
      return new Response(JSON.stringify({ code: 401, msg: "invalid JWT" }), { status: 401 });
    }
    return new Response(
      JSON.stringify({ id: "user-1", aud: "authenticated", app_metadata: { zai_consent: { v: 1 } }, user_metadata: {}, created_at: "" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function clientFor(authorization?: string) {
  const { createClientForRequest } = await import("@/server/supabase/server");
  return createClientForRequest(
    new Request("https://promptprinter.app/api/chat", {
      method: "POST",
      headers: authorization === undefined ? {} : { authorization },
    })
  );
}

describe("createClientForRequest", () => {
  it("mit Bearer fragt getUser() den Auth-Server mit genau diesem Token, ohne Cookies zu lesen oder zu setzen", async () => {
    const supabase = await clientFor("Bearer good-token");
    const { data, error } = await supabase.auth.getUser();

    expect(error).toBeNull();
    expect(data.user?.id).toBe("user-1");
    expect(data.user?.app_metadata).toEqual({ zai_consent: { v: 1 } });
    const userCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/v1/user"));
    expect(userCalls).toHaveLength(1);
    expect(cookieStore.getAll).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("ein ungültiges Bearer-Token ist kein Nutzer, auch wenn ein Cookie da wäre", async () => {
    const supabase = await clientFor("Bearer wrong-token");
    const { data } = await supabase.auth.getUser();

    expect(data.user).toBeNull();
    expect(cookieStore.getAll).not.toHaveBeenCalled();
  });

  it("ein leeres Bearer-Token ist ebenfalls kein Nutzer und fällt nicht auf das Cookie zurück", async () => {
    const supabase = await clientFor("Bearer");
    const { data } = await supabase.auth.getUser();

    expect(data.user).toBeNull();
    expect(cookieStore.getAll).not.toHaveBeenCalled();
  });

  it("ohne Authorization-Kopf (und mit einem fremden Schema) läuft alles über die Cookies wie bisher", async () => {
    const supabase = await clientFor();
    await supabase.auth.getUser();
    expect(cookieStore.getAll).toHaveBeenCalled();

    cookieStore.getAll.mockClear();
    const other = await clientFor("Basic dXNlcjpwdw==");
    await other.auth.getUser();
    expect(cookieStore.getAll).toHaveBeenCalled();
  });
});

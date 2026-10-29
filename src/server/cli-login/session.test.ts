import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
const generateLink = vi.fn();
const adminGetUser = vi.fn();
const adminSignOut = vi.fn();
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      getUser: (...a: unknown[]) => adminGetUser(...a),
      admin: {
        getUserById: (...a: unknown[]) => getUserById(...a),
        generateLink: (...a: unknown[]) => generateLink(...a),
        signOut: (...a: unknown[]) => adminSignOut(...a),
      },
    },
  }),
}));

const verifyOtp = vi.fn();
const refreshSession = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      refreshSession: (...a: unknown[]) => refreshSession(...a),
    },
  }),
}));

import { issueCliSession, refreshCliSession, revokeCliSession } from "@/server/cli-login/session";

const RAW = { access_token: "a", refresh_token: "r", expires_at: 1_800_000_000, expires_in: 3600, token_type: "bearer" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  getUserById.mockResolvedValue({ data: { user: { id: "u1", email: "a@example.test" } }, error: null });
  generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash" } }, error: null });
  verifyOtp.mockResolvedValue({ data: { session: RAW, user: { id: "u1" } }, error: null });
});

describe("issueCliSession", () => {
  it("löst den Anmeldelink selbst ein: Mail-Adresse des Kontos, magiclink, Hash", async () => {
    expect(await issueCliSession("u1")).toEqual({
      access_token: "a",
      refresh_token: "r",
      expires_at: 1_800_000_000,
      expires_in: 3600,
      token_type: "bearer",
    });
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "a@example.test" });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "magiclink" });
  });

  it("ohne Konto oder ohne E-Mail-Adresse gibt es keine Sitzung, und es wird kein Link erzeugt", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { message: "not found" } });
    expect(await issueCliSession("u1")).toBeNull();
    getUserById.mockResolvedValue({ data: { user: { id: "u1", email: null } }, error: null });
    expect(await issueCliSession("u1")).toBeNull();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("gehört die Sitzung einem anderen Konto (generateLink legt zu einer fremden Adresse ein neues an), gibt es keine", async () => {
    verifyOtp.mockResolvedValue({ data: { session: RAW, user: { id: "stranger" } }, error: null });
    expect(await issueCliSession("u1")).toBeNull();
  });

  it("scheitert generateLink oder verifyOtp, gibt es keine Sitzung", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await issueCliSession("u1")).toBeNull();
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash" } }, error: null });
    verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { message: "expired" } });
    expect(await issueCliSession("u1")).toBeNull();
  });
});

describe("refreshCliSession", () => {
  it("liefert die neue Sitzung", async () => {
    refreshSession.mockResolvedValue({ data: { session: RAW }, error: null });
    expect((await refreshCliSession("r0"))).toMatchObject({ access_token: "a", refresh_token: "r" });
    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: "r0" });
  });

  it("unterscheidet ein abgelehntes Token (4xx) von einem Ausfall des Auth-Servers", async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 400, message: "refresh_token_already_used" } });
    expect(await refreshCliSession("alt")).toBe("invalid");
    refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 500, message: "boom" } });
    expect(await refreshCliSession("x")).toBeNull();
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "network" } });
    expect(await refreshCliSession("x")).toBeNull();
  });
});

describe("revokeCliSession", () => {
  it("prüft das Token beim Auth-Server und beendet nur diese Sitzung (scope local)", async () => {
    adminGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    adminSignOut.mockResolvedValue({ error: null });
    expect(await revokeCliSession("tok")).toBe("ok");
    expect(adminGetUser).toHaveBeenCalledWith("tok");
    expect(adminSignOut).toHaveBeenCalledWith("tok", "local");
  });

  it("ein ungültiges oder zu einem gelöschten Konto gehörendes Token beendet nichts", async () => {
    adminGetUser.mockResolvedValue({ data: { user: null }, error: { status: 403, message: "user_not_found" } });
    expect(await revokeCliSession("tok")).toBe("unauthorized");
    expect(adminSignOut).not.toHaveBeenCalled();
  });

  it("antwortet der Auth-Server nicht, ist das kein 'ungültig'", async () => {
    adminGetUser.mockResolvedValue({ data: { user: null }, error: { status: 502, message: "bad gateway" } });
    expect(await revokeCliSession("tok")).toBeNull();
  });
});

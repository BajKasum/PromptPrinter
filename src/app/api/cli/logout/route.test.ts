import { beforeEach, describe, expect, it, vi } from "vitest";

// Bis auf den Service-Role-Client ist hier alles echt (session.ts, sessions.ts), denn es geht um die Reihenfolge:
// zuerst prüft der Auth-Server das Token, erst danach liest der Server cli_sessions.
const getUser = vi.fn();
const signOut = vi.fn();
const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a), admin: { signOut: (...a: unknown[]) => signOut(...a) } },
    from: (...a: unknown[]) => from(...a),
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));
const recordSecurityEvent = vi.fn();
vi.mock("@/server/security/security-events", () => ({
  recordSecurityEvent: (...a: unknown[]) => recordSecurityEvent(...a),
}));

import { POST } from "./route";

const SESSION = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

/** Ein JWT mit frei gewählten Claims. Ob die Signatur stimmt, entscheidet allein der Auth-Server (getUser). */
function jwt(claims: Record<string, unknown> = { session_id: SESSION, sub: USER }, signature = "signatur") {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: signature ? "HS256" : "none" })}.${part(claims)}.${signature}`;
}

/** Was die Suche in cli_sessions findet. */
let row: { data: unknown; error: unknown };

function table() {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => row,
  };
  return chain;
}

function post(authorization?: string) {
  return new Request("https://promptprinter.app/api/cli/logout", {
    method: "POST",
    headers: { "x-forwarded-for": "192.0.2.55", ...(authorization ? { authorization } : {}) },
  });
}

const entry = (expiresAt: number) => ({
  data: { expires_at: new Date(expiresAt).toISOString(), last_used_at: new Date().toISOString() },
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
  signOut.mockResolvedValue({ error: null });
  from.mockImplementation(() => table());
  row = entry(Date.now() + 60_000);
});

describe("POST /api/cli/logout", () => {
  it("beendet die Sitzung, deren Token im Kopf steht", async () => {
    const res = await POST(post(`Bearer ${jwt()}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getUser).toHaveBeenCalledWith(jwt());
    expect(from).toHaveBeenCalledWith("cli_sessions");
    expect(signOut).toHaveBeenCalledWith(jwt(), "local");
    expect(recordSecurityEvent).toHaveBeenCalledTimes(1);
    expect(recordSecurityEvent).toHaveBeenCalledWith("cli.session_revoked", USER, { via: "terminal" });
  });

  // #390: ein selbst gebautes JWT darf weder die Tabelle erreichen noch eine Sitzung anfassen. Mit Werten, die
  // keine UUID sind, antwortet Postgres mit einem Fehler (503 und Eintrag im Fehlerprotokoll).
  it.each([
    ["mit echt aussehenden Kennungen", jwt(undefined, "")],
    ["mit Werten, die keine UUID sind", jwt({ session_id: "x", sub: "y" }, "")],
    ["mit gefälschter Signatur", jwt(undefined, "gefaelscht")],
    ["ohne die Form eines JWT", "kein-jwt"],
  ])("ein Token, das der Auth-Server ablehnt (%s), ergibt 401, ohne die Tabelle zu lesen", async (_name, token) => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "bad_jwt" } });
    const res = await POST(post(`Bearer ${token}`));
    expect(res.status).toBe(401);
    expect((await res.json()).kind).toBe("unauthorized");
    expect(getUser).toHaveBeenCalledWith(token);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("beendet keine Browser-Sitzung und protokolliert kein Terminal", async () => {
    row = { data: null, error: null };
    const res = await POST(post(`Bearer ${jwt()}`));
    expect(res.status).toBe(401);
    expect(signOut).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("meldet auch eine Sitzung über dem Höchstalter ab, mit einem Ereignis", async () => {
    row = entry(Date.now() - 60_000);
    const res = await POST(post(`Bearer ${jwt()}`));
    expect(res.status).toBe(200);
    expect(signOut).toHaveBeenCalledWith(jwt(), "local");
    expect(rpc).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledTimes(1);
    expect(recordSecurityEvent).toHaveBeenCalledWith("cli.session_revoked", USER, { via: "terminal" });
  });

  it("ohne Bearer-Kopf, mit leerem oder fremdem Schema ergibt 401, ohne den Auth-Server zu fragen", async () => {
    for (const header of [undefined, "Bearer", "Bearer   ", "Basic abc"]) {
      const res = await POST(post(header));
      expect(res.status, String(header)).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("antwortet der Auth-Server nicht, ist das 503, und die Tabelle bleibt ungelesen", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 0, message: "fetch failed" } });
    const res = await POST(post(`Bearer ${jwt()}`));
    expect(res.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it("ein Lesefehler der Tabelle ist 503, die Sitzung bleibt", async () => {
    row = { data: null, error: { message: "db down" } };
    const res = await POST(post(`Bearer ${jwt()}`));
    expect(res.status).toBe(503);
    expect(signOut).not.toHaveBeenCalled();
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("scheitert das Abmelden beim Auth-Server, ist das 503 ohne Eintrag ins Protokoll", async () => {
    signOut.mockResolvedValue({ error: { status: 500, message: "boom" } });
    const res = await POST(post(`Bearer ${jwt()}`));
    expect(res.status).toBe(503);
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });
});

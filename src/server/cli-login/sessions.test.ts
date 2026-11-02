import { beforeEach, describe, expect, it, vi } from "vitest";

// Ein Double für den Service-Role-Client: je Tabelle eine Antwort, und was geschrieben wurde, steht in `writes`.
let selectResult: { data: unknown; error: unknown };
let insertResult: { error: unknown };
let rpcResult: { data: unknown; error: unknown };
const writes: { op: string; values: unknown; filters: [string, unknown][] }[] = [];
const rpc = vi.fn();

function builder() {
  const filters: [string, unknown][] = [];
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    },
    gt: () => chain,
    order: () => chain,
    maybeSingle: async () => selectResult,
    insert: async (values: unknown) => {
      writes.push({ op: "insert", values, filters });
      return insertResult;
    },
    update: (values: unknown) => {
      writes.push({ op: "update", values, filters });
      return chain;
    },
    then: (resolve: (v: unknown) => unknown) => resolve(selectResult),
  };
  return chain;
}

vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => builder(),
    rpc: (...a: unknown[]) => {
      rpc(...a);
      return Promise.resolve(rpcResult);
    },
  }),
}));

const recordSecurityEvent = vi.fn();
vi.mock("@/server/security/security-events", () => ({
  recordSecurityEvent: (...a: unknown[]) => recordSecurityEvent(...a),
}));

import {
  CLI_SESSION_MAX_AGE_MS,
  checkCliSession,
  endCliSession,
  listCliSessions,
  registerCliSession,
} from "@/server/cli-login/sessions";

const SESSION = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function token(claims: Record<string, unknown> = { session_id: SESSION, sub: USER }) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part(claims)}.signatur`;
}

const inFuture = () => new Date(Date.now() + 60_000).toISOString();
const inPast = () => new Date(Date.now() - 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  writes.length = 0;
  selectResult = { data: null, error: null };
  insertResult = { error: null };
  rpcResult = { data: true, error: null };
});

describe("registerCliSession", () => {
  it("trägt Sitzung, Konto, Name und das Ende nach dem Höchstalter ein", async () => {
    const before = Date.now();
    expect(await registerCliSession(token(), "pp auf Laptop")).toBe(true);
    const [write] = writes;
    expect(write.op).toBe("insert");
    const values = write.values as Record<string, string>;
    expect(values).toMatchObject({ session_id: SESSION, user_id: USER, client_name: "pp auf Laptop" });
    const expires = new Date(values.expires_at).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + CLI_SESSION_MAX_AGE_MS);
    expect(expires).toBeLessThanOrEqual(Date.now() + CLI_SESSION_MAX_AGE_MS);
  });

  it("nennt das Höchstalter von 30 Tagen", () => {
    expect(CLI_SESSION_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it.each(["kein-jwt", "a.b.c", token({ sub: USER }), token({ session_id: SESSION })])(
    "trägt nichts ein, wenn das Token keine Sitzung nennt: %s",
    async (value) => {
      expect(await registerCliSession(value, "x")).toBe(false);
      expect(writes).toEqual([]);
    }
  );

  it("meldet false, wenn das Eintragen scheitert", async () => {
    insertResult = { error: { message: "db down" } };
    expect(await registerCliSession(token(), "x")).toBe(false);
  });
});

describe("endCliSession", () => {
  it("beendet über die Funktion in der Datenbank und hält es fest", async () => {
    expect(await endCliSession(SESSION, USER, "settings")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("end_cli_session", { target_session: SESSION, target_user: USER });
    expect(recordSecurityEvent).toHaveBeenCalledWith("cli.session_revoked", USER, { via: "settings" });
  });

  it("false ohne Eintrag ins Protokoll, wenn nichts beendet wurde (fremd oder schon weg)", async () => {
    rpcResult = { data: false, error: null };
    expect(await endCliSession(SESSION, USER, "settings")).toBe(false);
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("wirft bei einem Datenbankfehler", async () => {
    rpcResult = { data: null, error: { message: "db down" } };
    await expect(endCliSession(SESSION, USER, "settings")).rejects.toThrow("end_cli_session");
  });
});

describe("checkCliSession", () => {
  it("ok für eine eingetragene, gültige Sitzung, gefragt nach Sitzung UND Konto", async () => {
    selectResult = { data: { expires_at: inFuture(), last_used_at: new Date().toISOString() }, error: null };
    expect(await checkCliSession(token())).toBe("ok");
    expect(writes).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("unknown für ein Token ohne Eintrag, etwa das einer Browser-Sitzung", async () => {
    expect(await checkCliSession(token())).toBe("unknown");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("unknown für etwas, das kein Token ist", async () => {
    expect(await checkCliSession("kein-jwt")).toBe("unknown");
  });

  it("expired für eine zu alte Sitzung, und sie wird gleich beendet", async () => {
    selectResult = { data: { expires_at: inPast(), last_used_at: inPast() }, error: null };
    expect(await checkCliSession(token())).toBe("expired");
    expect(rpc).toHaveBeenCalledWith("end_cli_session", { target_session: SESSION, target_user: USER });
    expect(recordSecurityEvent).toHaveBeenCalledWith("cli.session_revoked", USER, { via: "max_age" });
  });

  it("schreibt 'zuletzt benutzt' nur, wenn es länger her ist, und nur für dieses Konto", async () => {
    const old = new Date(Date.now() - 16 * 60_000).toISOString();
    selectResult = { data: { expires_at: inFuture(), last_used_at: old }, error: null };
    expect(await checkCliSession(token())).toBe("ok");
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
    expect(writes[0].filters).toEqual(
      expect.arrayContaining([
        ["session_id", SESSION],
        ["user_id", USER],
      ])
    );
  });

  it("wirft bei einem Lesefehler, ein Ausfall ist keine Absage", async () => {
    selectResult = { data: null, error: { message: "db down" } };
    await expect(checkCliSession(token())).rejects.toThrow("cli_sessions select");
  });
});

describe("listCliSessions", () => {
  it("liefert die Sitzungen in der Form für die Einstellungen", async () => {
    selectResult = {
      data: [
        {
          session_id: SESSION,
          client_name: "pp",
          created_at: "2026-11-01T10:00:00Z",
          last_used_at: "2026-11-02T10:00:00Z",
          expires_at: "2026-12-01T10:00:00Z",
        },
      ],
      error: null,
    };
    expect(await listCliSessions(USER)).toEqual([
      {
        id: SESSION,
        clientName: "pp",
        createdAt: "2026-11-01T10:00:00Z",
        lastUsedAt: "2026-11-02T10:00:00Z",
        expiresAt: "2026-12-01T10:00:00Z",
      },
    ]);
  });

  it("wirft bei einem Lesefehler", async () => {
    selectResult = { data: null, error: { message: "db down" } };
    await expect(listCliSessions(USER)).rejects.toThrow("cli_sessions select");
  });
});

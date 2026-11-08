import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createClientForRequest = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createClientForRequest: (...a: unknown[]) => createClientForRequest(...a),
}));

const checkCliSession = vi.fn();
vi.mock("@/server/cli-login/sessions", () => ({ checkCliSession: (...a: unknown[]) => checkCliSession(...a) }));

const rateLimit = vi.fn();
const rateLimitKey = vi.fn();
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: (...a: unknown[]) => rateLimitKey(...a),
}));

import { GET } from "./route";

const ID = "6f1c2a8e-3b4d-4e5f-9a0b-1c2d3e4f5a6b";
const OWNER = "u1";

type Row = { id: string; user_id: string; created_at: string; outputs: unknown };

// Eine kleine Tabelle, die die Filter wirklich anwendet: so zeigt der Test, dass ohne `user_id`-Filter eine
// fremde Zeile durchkäme (die RLS fehlt im Test, genau wie sie in einem Fehlerfall fehlen könnte).
let table: Row[] = [];
let readError: unknown = null;
const eqCalls: [string, unknown][] = [];

function client() {
  return {
    auth: { getUser },
    from: () => {
      const filters: [string, unknown][] = [];
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          filters.push([column, value]);
          return chain;
        },
        maybeSingle: () => {
          if (readError) return Promise.resolve({ data: null, error: readError });
          const hit = table.find((r) => filters.every(([c, v]) => r[c as keyof Row] === v)) ?? null;
          return Promise.resolve({ data: hit, error: null });
        },
      };
      return chain;
    },
  };
}

function get(id = ID, authorization: string | null = "Bearer tok") {
  const req = new Request(`https://promptprinter.app/api/cli/prompts/${id}`, {
    headers: { "x-forwarded-for": "192.0.2.62", ...(authorization ? { authorization } : {}) },
  });
  return GET(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;
  readError = null;
  table = [
    {
      id: ID,
      user_id: OWNER,
      created_at: "2026-11-05T10:00:00+00:00",
      outputs: { prompt: "Plane die Woche", title: "Wochenplan" },
    },
  ];
  rateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 1000 });
  rateLimitKey.mockReturnValue("key");
  createClientForRequest.mockResolvedValue(client());
  checkCliSession.mockResolvedValue("ok");
  getUser.mockResolvedValue({ data: { user: { id: OWNER } } });
});

describe("GET /api/cli/prompts/[id]", () => {
  it("gibt den ganzen Prompt mit Titel und Datum, ohne Cache", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      id: ID,
      title: "Wochenplan",
      content: "Plane die Woche",
      createdAt: "2026-11-05T10:00:00+00:00",
    });
  });

  it("fragt ausdrücklich nach dem eigenen Konto (zweite Linie neben RLS)", async () => {
    await get();
    expect(eqCalls).toContainEqual(["id", ID]);
    expect(eqCalls).toContainEqual(["user_id", OWNER]);
  });

  it("eine fremde Zeile und eine, die es nicht gibt, bekommen dieselbe Antwort 404 notFound", async () => {
    table[0].user_id = "jemand-anders";
    const foreign = await get();
    const missing = await get("00000000-0000-4000-8000-000000000000");
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect((await get()).headers.get("content-type")).toContain("problem+json");
  });

  it("eine Zeile ohne lesbaren Prompt ist 404", async () => {
    table[0].outputs = { title: "nur Titel" };
    const res = await get();
    expect(res.status).toBe(404);
    expect((await res.json()).kind).toBe("notFound");
  });

  it("keine UUID ist 400 invalid, ohne den Auth-Server oder die Datenbank zu fragen", async () => {
    for (const id of ["abc", "1", `${ID}x`, "6f1c2a8e3b4d4e5f9a0b1c2d3e4f5a6b", "6f1c2a8e-3b4d-4e5f-9a0b-1c2d3e4f5a6b,or("]) {
      const res = await get(id);
      expect(res.status, id).toBe(400);
      expect((await res.json()).kind).toBe("invalid");
    }
    expect(getUser).not.toHaveBeenCalled();
    expect(eqCalls).toEqual([]);
  });

  it("ohne Bearer-Kopf oder mit fremdem Schema 401, ohne den Auth-Server zu fragen", async () => {
    for (const header of [null, "Basic abc"]) {
      const res = await get(ID, header);
      expect(res.status, String(header)).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(createClientForRequest).not.toHaveBeenCalled();
  });

  it("ein ungültiges Token ergibt 401 und liest nichts", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await get()).status).toBe(401);
    expect(eqCalls).toEqual([]);
  });

  it("nur ein eingetragenes Terminal: sonst 401 und keine Abfrage, ein Ausfall 503", async () => {
    for (const verdict of ["unknown", "expired"]) {
      checkCliSession.mockResolvedValue(verdict);
      const res = await get();
      expect(res.status, verdict).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(checkCliSession).toHaveBeenCalledWith("tok");
    expect(eqCalls).toEqual([]);
    checkCliSession.mockRejectedValue(new Error("kaputt"));
    expect((await get()).status).toBe(503);
  });

  it("ein Lesefehler ist nicht 'nicht gefunden', sondern 503 unavailable", async () => {
    readError = { message: "kaputt" };
    const res = await get();
    expect(res.status).toBe(503);
    expect((await res.json()).kind).toBe("unavailable");
  });

  it("das Ratenlimit hat einen eigenen Namen, greift vor dem Auth-Server und nennt die Wartezeit", async () => {
    rateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 30_000 });
    const res = await get();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.kind).toBe("rate_limited");
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(rateLimitKey.mock.calls[0][1]).toBe("cli-prompt");
    expect(getUser).not.toHaveBeenCalled();
  });
});

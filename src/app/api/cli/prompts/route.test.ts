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

type Row = { id: string; created_at: string; outputs: unknown };

// Jede Abfrage schreibt ihre Filter mit; `answer` entscheidet je Abfrage, was sie liefert.
let queries: { table: string; calls: [string, ...unknown[]][] }[] = [];
let answer: (calls: [string, ...unknown[]][]) => { data: Row[] | null; error: unknown };

function client() {
  return {
    auth: { getUser },
    from: (table: string) => {
      const q = { table, calls: [] as [string, ...unknown[]][] };
      queries.push(q);
      const chain = {
        select: (...a: unknown[]) => (q.calls.push(["select", ...a]), chain),
        eq: (...a: unknown[]) => (q.calls.push(["eq", ...a]), chain),
        order: (...a: unknown[]) => (q.calls.push(["order", ...a]), chain),
        ilike: (...a: unknown[]) => (q.calls.push(["ilike", ...a]), chain),
        limit: (...a: unknown[]) => {
          q.calls.push(["limit", ...a]);
          return Promise.resolve(answer(q.calls));
        },
      };
      return chain;
    },
  };
}

function row(id: string, createdAt: string, outputs: unknown): Row {
  return { id, created_at: createdAt, outputs };
}

const A = row("a", "2026-11-03T10:00:00+00:00", { prompt: "Schreib eine Mail an das Team", title: "Mail" });
const B = row("b", "2026-11-05T10:00:00+00:00", { prompt: "Plane die Woche", title: "Wochenplan" });

function get(search = "", authorization: string | null = "Bearer tok") {
  return new Request(`https://promptprinter.app/api/cli/prompts${search}`, {
    headers: { "x-forwarded-for": "192.0.2.61", ...(authorization ? { authorization } : {}) },
  });
}

function calls(name: string) {
  return queries.flatMap((q) => q.calls.filter((c) => c[0] === name));
}

beforeEach(() => {
  vi.clearAllMocks();
  queries = [];
  answer = () => ({ data: [A, B], error: null });
  rateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 1000 });
  rateLimitKey.mockReturnValue("key");
  createClientForRequest.mockResolvedValue(client());
  checkCliSession.mockResolvedValue("ok");
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("GET /api/cli/prompts", () => {
  it("listet neueste zuerst, mit Titel, Datum und Vorschau, ohne Cache", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      prompts: [
        { id: "b", title: "Wochenplan", createdAt: B.created_at, preview: "Plane die Woche" },
        { id: "a", title: "Mail", createdAt: A.created_at, preview: "Schreib eine Mail an das Team" },
      ],
    });
    expect(calls("order")).toEqual([["order", "created_at", { ascending: false }]]);
    expect(calls("limit")).toEqual([["limit", 20]]);
    expect(queries[0].table).toBe("saved_prompts");
  });

  it("fragt ausdrücklich nach dem eigenen Konto (zweite Linie neben RLS), auch bei jeder Suchabfrage", async () => {
    await GET(get("?q=mail"));
    expect(queries).toHaveLength(2);
    for (const q of queries) expect(q.calls).toContainEqual(["eq", "user_id", "u1"]);
  });

  it("die Vorschau hat höchstens 200 Zeichen und schneidet kein Emoji entzwei", async () => {
    const long = "🙂".repeat(150) + "x".repeat(100);
    answer = () => ({ data: [row("c", "2026-11-06T00:00:00+00:00", { prompt: long, title: "Lang" })], error: null });
    const [item] = (await (await GET(get())).json()).prompts;
    expect(Array.from(item.preview)).toHaveLength(200);
    expect(item.preview).toBe("🙂".repeat(150) + "x".repeat(50));
  });

  it("lässt Zeilen ohne lesbaren Prompt aus und nimmt einen fehlenden Titel als Ersatztitel", async () => {
    answer = () => ({
      data: [
        row("leer", "2026-11-07T00:00:00+00:00", { prompt: "   ", title: "Leer" }),
        row("kaputt", "2026-11-07T00:00:00+00:00", null),
        row("ohne-titel", "2026-11-06T00:00:00+00:00", { prompt: "Text" }),
      ],
      error: null,
    });
    const { prompts } = await (await GET(get())).json();
    expect(prompts.map((p: { id: string }) => p.id)).toEqual(["ohne-titel"]);
    expect(prompts[0].title).toBe("Gespeicherter Prompt");
  });

  it("limit: Standard 20, außerhalb von 1 bis 50 geklemmt, keine Zahl ist 400 invalid", async () => {
    for (const [value, expected] of [["1", 1], ["50", 50], ["0", 1], ["-5", 1], ["51", 50], ["999999", 50], ["", 20]] as const) {
      queries = [];
      expect((await GET(get(`?limit=${value}`))).status, value).toBe(200);
      expect(calls("limit"), value).toEqual([["limit", expected]]);
    }
    for (const value of ["abc", "2.5", "1e3", "12x"]) {
      const res = await GET(get(`?limit=${value}`));
      expect(res.status, value).toBe(400);
      expect((await res.json()).kind).toBe("invalid");
    }
  });

  it("schneidet die zusammengeführten Treffer auf limit", async () => {
    const res = await GET(get("?limit=1&q=a"));
    expect((await res.json()).prompts.map((p: { id: string }) => p.id)).toEqual(["b"]);
  });

  it("sucht je Spalte mit ilike, nie über .or(), und führt Titel- und Texttreffer ohne Doppel zusammen", async () => {
    answer = (c) => {
      const column = c.find((x) => x[0] === "ilike")?.[1];
      return { data: column === "outputs->>title" ? [A] : [A, B], error: null };
    };
    const { prompts } = await (await GET(get("?q=Mail"))).json();
    expect(prompts.map((p: { id: string }) => p.id)).toEqual(["b", "a"]);
    expect(calls("ilike")).toEqual([
      ["ilike", "outputs->>title", "%Mail%"],
      ["ilike", "outputs->>prompt", "%Mail%"],
    ]);
    expect(calls("or")).toEqual([]);
  });

  it("entschärft Sonderzeichen: LIKE-Platzhalter maskiert, Komma, Klammern und Punkt bleiben Text", async () => {
    await GET(get(`?q=${encodeURIComponent("50%_a\\b,c).or(user_id.neq.x")}`));
    expect(calls("ilike")[0]).toEqual(["ilike", "outputs->>title", "%50\\%\\_a\\\\b,c).or(user\\_id.neq.x%"]);
  });

  it("ein Stern wird ein Einzelplatzhalter und die Treffer werden genau nachgesiebt", async () => {
    answer = () => ({
      data: [
        row("echt", "2026-11-06T00:00:00+00:00", { prompt: "rechne 2*3", title: "Mathe" }),
        row("falsch", "2026-11-05T00:00:00+00:00", { prompt: "rechne 2+3", title: "Mathe" }),
      ],
      error: null,
    });
    const { prompts } = await (await GET(get(`?q=${encodeURIComponent("2*3")}`))).json();
    expect(calls("ilike")[0]).toEqual(["ilike", "outputs->>title", "%2_3%"]);
    expect(prompts.map((p: { id: string }) => p.id)).toEqual(["echt"]);
  });

  it("q: Leerraum allein ist keine Suche, mehr als 200 Zeichen sind 400 invalid", async () => {
    await GET(get("?q=%20%20"));
    expect(calls("ilike")).toEqual([]);
    expect((await GET(get(`?q=${"x".repeat(200)}`))).status).toBe(200);
    const res = await GET(get(`?q=${"x".repeat(201)}`));
    expect(res.status).toBe(400);
    expect((await res.json()).kind).toBe("invalid");
  });

  it("ohne Bearer-Kopf oder mit fremdem Schema 401, ohne den Auth-Server zu fragen", async () => {
    for (const header of [null, "Basic abc"]) {
      const res = await GET(get("", header));
      expect(res.status, String(header)).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(createClientForRequest).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("ein ungültiges Token oder ein gelöschtes Konto ergibt 401 und liest nichts", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect(queries).toEqual([]);
  });

  it("nur ein eingetragenes Terminal: sonst 401 und keine Abfrage, ein Ausfall 503", async () => {
    for (const verdict of ["unknown", "expired"]) {
      checkCliSession.mockResolvedValue(verdict);
      const res = await GET(get());
      expect(res.status, verdict).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(checkCliSession).toHaveBeenCalledWith("tok");
    expect(queries).toEqual([]);
    checkCliSession.mockRejectedValue(new Error("kaputt"));
    expect((await GET(get())).status).toBe(503);
  });

  it("ein Lesefehler ist keine leere Liste, sondern 503 unavailable", async () => {
    answer = () => ({ data: null, error: { message: "kaputt" } });
    const res = await GET(get());
    expect(res.status).toBe(503);
    expect((await res.json()).kind).toBe("unavailable");
  });

  it("das Ratenlimit hat einen eigenen Namen, greift vor dem Auth-Server und nennt die Wartezeit", async () => {
    rateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 30_000 });
    const res = await GET(get());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.kind).toBe("rate_limited");
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(rateLimitKey.mock.calls[0][1]).toBe("cli-prompts");
    expect(getUser).not.toHaveBeenCalled();
  });
});

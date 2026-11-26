import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getUser = vi.fn();
const profileSelect = vi.fn();
const rateLimit = vi.fn();
const captureError = vi.fn();
const logEvent = vi.fn();
const adminClient = vi.fn();

let profileColumns = "";

// Der Nutzer-Client: jede Tabelle ausser profiles liefert eine leere Seite, die
// Route soll hier nur zusammenstecken, nicht die Abschnitte prüfen (das macht
// account-export.test.ts).
vi.mock("@/server/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = (columns: string) => {
        if (table === "profiles") profileColumns = columns;
        return builder;
      };
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.maybeSingle = () => profileSelect();
      builder.range = () => Promise.resolve({ data: [], error: null });
      return builder;
    },
  })),
}));

// Der Service-Role-Client liest genau eine Tabelle, cli_sessions (die Terminals
// sieht der Nutzer-Client nicht), und nur für dieses Konto. Jede andere Abfrage
// über ihn hält adminQueries fest, und der Test unten scheitert.
type AdminQuery = { table: string; filters: [string, string, unknown][] };
const adminQueries: AdminQuery[] = [];
let terminalResult: { data: unknown; error: unknown } = { data: [], error: null };
const adminFake = {
  from(table: string) {
    const query: AdminQuery = { table, filters: [] };
    adminQueries.push(query);
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        query.filters.push(["eq", column, value]);
        return builder;
      },
      gt: (column: string, value: unknown) => {
        query.filters.push(["gt", column, value]);
        return builder;
      },
      order: () => Promise.resolve(terminalResult),
    };
    return builder;
  },
};
vi.mock("@/server/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => adminClient(...args),
}));

vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  rateLimitKey: () => "u:user-1",
}));

vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()),
  captureError: (...args: unknown[]) => captureError(...args),
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

function req(headers: Record<string, string> = {}) {
  return new Request("https://promptprinter.app/api/account/export", { headers });
}

const USER = { id: "user-1", email: "du@example.com", created_at: "2026-05-01T00:00:00Z" };

describe("GET /api/account/export", () => {
  beforeEach(() => {
    getUser.mockReset();
    profileSelect.mockReset();
    rateLimit.mockReset();
    captureError.mockReset();
    logEvent.mockReset();
    adminClient.mockReset();
    adminClient.mockImplementation(() => adminFake);
    adminQueries.length = 0;
    terminalResult = { data: [], error: null };
    profileColumns = "";
    getUser.mockResolvedValue({ data: { user: USER } });
    profileSelect.mockResolvedValue({
      data: { display_name: "Du", plan: "free", settings: {}, is_admin: false },
      error: null,
    });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 });
  });

  it("liefert die Datei als Download mit den Kopfzeilen, die persönliche Daten verlangen", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="promptprinter-export-\d{4}-\d{2}-\d{2}\.json"$/
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("der Rumpf ist gültiges JSON mit dem Konto des Nutzers", async () => {
    const json = JSON.parse(await (await GET(req())).text());
    expect(json.account).toMatchObject({ id: "user-1", email: "du@example.com", displayName: "Du" });
    expect(json.projects).toEqual([]);
    expect(json.promptShares).toEqual([]);
    expect(json.terminalSessions).toEqual([]);
    expect(typeof json.note).toBe("string");
    expect(json.note.length).toBeGreaterThan(20);
  });

  it("verlangt eine Sitzung und fragt ohne sie nichts ab", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(profileSelect).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
    expect(adminQueries).toEqual([]);
  });

  it("lehnt eine seitenübergreifende Anfrage ab, bevor irgendetwas gelesen wird", async () => {
    const res = await GET(req({ "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each(["same-origin", "none", "same-site"])("lässt Sec-Fetch-Site: %s durch", async (site) => {
    const res = await GET(req({ "sec-fetch-site": site }));
    expect(res.status).toBe(200);
  });

  it("lässt Anfragen ohne Sec-Fetch-Site durch (ältere Browser, Werkzeuge)", async () => {
    expect((await GET(req())).status).toBe(200);
  });

  it("begrenzt die Häufigkeit und antwortet mit 429 samt Wartezeit", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 90_000 });
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect((await res.json()).retryAfter).toBeGreaterThan(0);
    expect(rateLimit).toHaveBeenCalledWith("u:user-1", { limit: 5, windowMs: 60 * 60 * 1000 });
    expect(adminQueries).toEqual([]);
  });

  it("nimmt den Betreiber von der Begrenzung aus, wie die übrigen Routen", async () => {
    profileSelect.mockResolvedValue({
      data: { display_name: "Ich", plan: "free", settings: {}, is_admin: true },
      error: null,
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("antwortet mit 503 statt mit einer halben Datei, wenn das Profil nicht lesbar ist", async () => {
    profileSelect.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(captureError).toHaveBeenCalledWith(
      "account.export_profile_failed",
      expect.anything(),
      expect.objectContaining({ userId: "user-1" })
    );
  });

  it("liest mit dem Service-Role-Client nur die Terminals, und nur die dieses Kontos", async () => {
    await (await GET(req())).text();
    expect(adminQueries.map((q) => q.table)).toEqual(["cli_sessions"]);
    expect(adminQueries[0].filters).toContainEqual(["eq", "user_id", "user-1"]);
  });

  it("nimmt die Terminals ohne die Kennung ihrer Sitzung in die Datei auf", async () => {
    terminalResult = {
      data: [
        { session_id: "sitzung-GEHEIM", client_name: "laptop", created_at: "t1", last_used_at: "t2", expires_at: "t3" },
      ],
      error: null,
    };
    const text = await (await GET(req())).text();
    expect(JSON.parse(text).terminalSessions).toEqual([
      { clientName: "laptop", createdAt: "t1", lastUsedAt: "t2", expiresAt: "t3" },
    ]);
    expect(text).not.toContain("sitzung-GEHEIM");
  });

  it("antwortet mit 503 statt mit einer Datei ohne Terminals, wenn sie nicht lesbar sind", async () => {
    terminalResult = { data: null, error: { message: "db down" } };
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(captureError).toHaveBeenCalledWith(
      "account.export_terminals_failed",
      expect.any(Error),
      expect.objectContaining({ userId: "user-1" })
    );
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("liest vom Profil nur die Positivliste, nie die Kundennummer des Zahlungsanbieters", async () => {
    await GET(req());
    expect(profileColumns).not.toContain("*");
    expect(profileColumns).not.toMatch(/customer_id|subscription_id|portal_url|stripe/);
  });

  it("protokolliert den Export ohne Inhalte", async () => {
    await (await GET(req())).text();
    expect(logEvent).toHaveBeenCalledWith("account.export", { userId: "user-1" });
  });
});

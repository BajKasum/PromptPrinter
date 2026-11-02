import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
const listCliSessions = vi.fn();
const endCliSession = vi.fn();
vi.mock("@/server/cli-login/sessions", () => ({
  listCliSessions: (...a: unknown[]) => listCliSessions(...a),
  endCliSession: (...a: unknown[]) => endCliSession(...a),
}));

import { DELETE, GET } from "./route";

const SESSION = "11111111-1111-4111-8111-111111111111";
const ROW = {
  id: SESSION,
  clientName: "pp auf Laptop",
  createdAt: "2026-11-01T10:00:00Z",
  lastUsedAt: "2026-11-02T10:00:00Z",
  expiresAt: "2026-12-01T10:00:00Z",
};

let counter = 0;
let currentUser = "";

const request = (method: string, query = "") =>
  new Request(`https://promptprinter.app/api/cli/sessions${query}`, { method });

beforeEach(() => {
  vi.clearAllMocks();
  // Ein eigener Nutzer je Test: das Ratenlimit (im Speicher, ohne Upstash) zählt je Nutzer.
  counter += 1;
  currentUser = `user-${counter}`;
  getUser.mockResolvedValue({ data: { user: { id: currentUser } } });
  listCliSessions.mockResolvedValue([ROW]);
  endCliSession.mockResolvedValue(true);
});

describe("GET /api/cli/sessions", () => {
  it("liefert die Terminals dieses Kontos, ohne Cache", async () => {
    const res = await GET(request("GET"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ sessions: [ROW] });
    expect(listCliSessions).toHaveBeenCalledWith(currentUser);
  });

  it("ohne Sitzung 401, und nichts wird gelesen", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(request("GET"))).status).toBe(401);
    expect(listCliSessions).not.toHaveBeenCalled();
  });

  it("ein Datenbankfehler ist 503, nie eine leere Liste", async () => {
    listCliSessions.mockRejectedValue(new Error("db down"));
    expect((await GET(request("GET"))).status).toBe(503);
  });
});

describe("DELETE /api/cli/sessions", () => {
  it("meldet genau diese Sitzung für dieses Konto ab", async () => {
    const res = await DELETE(request("DELETE", `?id=${SESSION}`));
    expect(res.status).toBe(200);
    expect(endCliSession).toHaveBeenCalledWith(SESSION, currentUser, "settings");
  });

  it("ohne Sitzung 401, und nichts wird beendet", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await DELETE(request("DELETE", `?id=${SESSION}`))).status).toBe(401);
    expect(endCliSession).not.toHaveBeenCalled();
  });

  it.each(["", "?id=", "?id=kein-uuid", "?id=1' or '1'='1"])("eine falsche Kennung ist 404, ohne Datenbank: %s", async (query) => {
    expect((await DELETE(request("DELETE", query))).status).toBe(404);
    expect(endCliSession).not.toHaveBeenCalled();
  });

  it("fremd oder schon weg ist 404, ohne zu verraten, was davon", async () => {
    endCliSession.mockResolvedValue(false);
    const res = await DELETE(request("DELETE", `?id=${SESSION}`));
    expect(res.status).toBe(404);
    expect((await res.json()).kind).toBe("not_found");
  });

  it("ein Datenbankfehler ist 503", async () => {
    endCliSession.mockRejectedValue(new Error("db down"));
    expect((await DELETE(request("DELETE", `?id=${SESSION}`))).status).toBe(503);
  });

  it("begrenzt das Abmelden je Konto", async () => {
    let last = 0;
    for (let i = 0; i < 61; i += 1) last = (await DELETE(request("DELETE", `?id=${SESSION}`))).status;
    expect(last).toBe(429);
  });
});

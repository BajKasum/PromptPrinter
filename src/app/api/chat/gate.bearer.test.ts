import { beforeEach, describe, expect, it, vi } from "vitest";
import { de } from "@/shared/i18n/messages/de";

// Der Bearer-Weg des Chats gilt nur für ein eingetragenes Terminal bis zu seinem Höchstalter. Der Auth-Server kann das nicht
// wissen: für ihn sind das Token einer Browser-Sitzung und eine zu alte Sitzung gültig.

const getUser = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createClientForRequest: async () => ({ auth: { getUser } }),
}));
const checkCliSession = vi.fn();
vi.mock("@/server/cli-login/sessions", () => ({
  checkCliSession: (...a: unknown[]) => checkCliSession(...a),
}));

const { authenticate } = await import("./gate");

const m = de.api;
const request = (headers: Record<string, string> = {}) =>
  new Request("https://promptprinter.app/api/chat", { method: "POST", headers });

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: {} } } });
  checkCliSession.mockResolvedValue("ok");
});

describe("authenticate", () => {
  it("fragt beim Cookie nicht nach einem Terminal", async () => {
    const result = await authenticate(request(), m);
    expect(result).not.toBeInstanceOf(Response);
    expect(checkCliSession).not.toHaveBeenCalled();
  });

  it("lässt ein eingetragenes Terminal durch", async () => {
    const result = await authenticate(request({ authorization: "Bearer tok" }), m);
    expect(result).not.toBeInstanceOf(Response);
    expect(checkCliSession).toHaveBeenCalledWith("tok");
  });

  it.each(["unknown", "expired"])("%s: 401, obwohl der Auth-Server das Token kennt", async (verdict) => {
    checkCliSession.mockResolvedValue(verdict);
    const result = await authenticate(request({ authorization: "Bearer tok" }), m);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("ein Datenbankfehler ist 503, keine Abmeldung und kein Durchlass", async () => {
    checkCliSession.mockRejectedValue(new Error("db down"));
    const result = await authenticate(request({ authorization: "Bearer tok" }), m);
    expect((result as Response).status).toBe(503);
  });

  it("fragt nicht nach dem Terminal, wenn der Auth-Server das Token schon abgelehnt hat", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await authenticate(request({ authorization: "Bearer tot" }), m);
    expect((result as Response).status).toBe(401);
    expect(checkCliSession).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const revokeCliSession = vi.fn();
vi.mock("@/server/cli-login/session", () => ({
  revokeCliSession: (...a: unknown[]) => revokeCliSession(...a),
}));

import { POST } from "./route";

function post(authorization?: string) {
  return new Request("https://promptprinter.app/api/cli/logout", {
    method: "POST",
    headers: { "x-forwarded-for": "192.0.2.55", ...(authorization ? { authorization } : {}) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  revokeCliSession.mockResolvedValue("ok");
});

describe("POST /api/cli/logout", () => {
  it("beendet die Sitzung, deren Token im Kopf steht", async () => {
    const res = await POST(post("Bearer access-token"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(revokeCliSession).toHaveBeenCalledWith("access-token");
  });

  it("ohne Bearer-Kopf, mit leerem oder fremdem Schema ergibt 401, ohne den Auth-Server zu fragen", async () => {
    for (const header of [undefined, "Bearer", "Bearer   ", "Basic abc"]) {
      const res = await POST(post(header));
      expect(res.status, String(header)).toBe(401);
      expect((await res.json()).kind).toBe("unauthorized");
    }
    expect(revokeCliSession).not.toHaveBeenCalled();
  });

  it("ein ungültiges Token ergibt 401, ein Ausfall des Auth-Servers 503", async () => {
    revokeCliSession.mockResolvedValue("unauthorized");
    expect((await POST(post("Bearer tot"))).status).toBe(401);
    revokeCliSession.mockResolvedValue(null);
    expect((await POST(post("Bearer x"))).status).toBe(503);
  });
});

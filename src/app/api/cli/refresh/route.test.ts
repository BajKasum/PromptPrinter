import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshCliSession = vi.fn();
vi.mock("@/server/cli-login/session", () => ({
  refreshCliSession: (...a: unknown[]) => refreshCliSession(...a),
}));

import { POST } from "./route";

const SESSION = { access_token: "a", refresh_token: "r2", expires_at: 1, expires_in: 3600, token_type: "bearer" };

function post(body: unknown, raw?: string) {
  return new Request("https://promptprinter.app/api/cli/refresh", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.44" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  refreshCliSession.mockResolvedValue(SESSION);
});

describe("POST /api/cli/refresh", () => {
  it("tauscht das Refresh-Token gegen eine neue Sitzung und liefert sie ohne Cache", async () => {
    const res = await POST(post({ refreshToken: "r1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ session: SESSION });
    expect(refreshCliSession).toHaveBeenCalledWith("r1");
  });

  it("ein abgelehntes Token ergibt 401 invalid_token, ein Ausfall des Auth-Servers 503", async () => {
    refreshCliSession.mockResolvedValue("invalid");
    const rejected = await POST(post({ refreshToken: "alt" }));
    expect(rejected.status).toBe(401);
    expect((await rejected.json()).kind).toBe("invalid_token");

    refreshCliSession.mockResolvedValue(null);
    expect((await POST(post({ refreshToken: "r" }))).status).toBe(503);
  });

  it("weist ein fehlendes oder zu langes Token und kaputtes JSON mit 400 ab", async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ refreshToken: "x".repeat(513) }))).status).toBe(400);
    expect((await POST(post(null, "kein json"))).status).toBe(400);
    expect(refreshCliSession).not.toHaveBeenCalled();
  });
});

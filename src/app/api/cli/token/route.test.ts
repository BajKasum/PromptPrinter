import { beforeEach, describe, expect, it, vi } from "vitest";
import { newDeviceCode } from "@/server/cli-login/codes";

const findRequestByDeviceCode = vi.fn();
const markPolled = vi.fn();
const claimApprovedRequest = vi.fn();
vi.mock("@/server/cli-login/store", () => ({
  findRequestByDeviceCode: (...a: unknown[]) => findRequestByDeviceCode(...a),
  markPolled: (...a: unknown[]) => markPolled(...a),
  claimApprovedRequest: (...a: unknown[]) => claimApprovedRequest(...a),
}));
const issueCliSession = vi.fn();
vi.mock("@/server/cli-login/session", () => ({
  issueCliSession: (...a: unknown[]) => issueCliSession(...a),
}));

import { POST } from "./route";

const SESSION = {
  access_token: "access",
  refresh_token: "refresh",
  expires_at: 1_800_000_000,
  expires_in: 3600,
  token_type: "bearer",
};
const future = () => new Date(Date.now() + 5 * 60_000).toISOString();

function post(body: unknown) {
  return new Request("https://promptprinter.app/api/cli/token", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.9" },
    body: JSON.stringify(body),
  });
}

let deviceCode = "";
beforeEach(() => {
  vi.clearAllMocks();
  deviceCode = newDeviceCode();
  findRequestByDeviceCode.mockResolvedValue({
    id: "req-1",
    status: "pending",
    user_id: null,
    expires_at: future(),
    last_polled_at: null,
  });
  claimApprovedRequest.mockResolvedValue("user-1");
  issueCliSession.mockResolvedValue(SESSION);
});

async function kind(res: Response) {
  return (await res.json()).kind;
}

describe("POST /api/cli/token", () => {
  it("pending: 200 mit der Pause, merkt sich die Abfrage und liefert keine Sitzung", async () => {
    const res = await POST(post({ deviceCode }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "pending", interval: 5 });
    expect(markPolled).toHaveBeenCalledWith("req-1");
    expect(claimApprovedRequest).not.toHaveBeenCalled();
    expect(issueCliSession).not.toHaveBeenCalled();
  });

  it("pending, aber vor einer Sekunde schon gefragt: 429 slow_down, ohne die Zeit neu zu setzen", async () => {
    findRequestByDeviceCode.mockResolvedValue({
      id: "req-1",
      status: "pending",
      user_id: null,
      expires_at: future(),
      last_polled_at: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await POST(post({ deviceCode }));
    expect(res.status).toBe(429);
    expect(await kind(res)).toBe("slow_down");
    expect(markPolled).not.toHaveBeenCalled();
  });

  it("approved: liefert die Sitzung und holt die Anfrage genau einmal ab", async () => {
    findRequestByDeviceCode.mockResolvedValue({ id: "req-1", status: "approved", user_id: "user-1", expires_at: future(), last_polled_at: null });
    const res = await POST(post({ deviceCode }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "approved", session: SESSION });
    expect(claimApprovedRequest).toHaveBeenCalledWith("req-1");
    expect(issueCliSession).toHaveBeenCalledWith("user-1");
  });

  it("approved, aber ein anderer Aufruf war schneller (Abholen trifft nichts): invalid, keine zweite Sitzung", async () => {
    findRequestByDeviceCode.mockResolvedValue({ id: "req-1", status: "approved", user_id: "user-1", expires_at: future(), last_polled_at: null });
    claimApprovedRequest.mockResolvedValue(null);
    const res = await POST(post({ deviceCode }));
    expect(res.status).toBe(400);
    expect(await kind(res)).toBe("invalid");
    expect(issueCliSession).not.toHaveBeenCalled();
  });

  it("zwei gleichzeitige Abfragen: nur die, die das Abholen gewinnt, bekommt eine Sitzung", async () => {
    findRequestByDeviceCode.mockResolvedValue({ id: "req-1", status: "approved", user_id: "user-1", expires_at: future(), last_polled_at: null });
    claimApprovedRequest.mockResolvedValueOnce("user-1").mockResolvedValue(null);
    const [a, b] = await Promise.all([POST(post({ deviceCode })), POST(post({ deviceCode }))]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(issueCliSession).toHaveBeenCalledTimes(1);
  });

  it("approved, aber die Sitzung lässt sich nicht ausstellen: 503 session_failed (Code ist verbraucht)", async () => {
    findRequestByDeviceCode.mockResolvedValue({ id: "req-1", status: "approved", user_id: "user-1", expires_at: future(), last_polled_at: null });
    issueCliSession.mockResolvedValue(null);
    const res = await POST(post({ deviceCode }));
    expect(res.status).toBe(503);
    expect(await kind(res)).toBe("session_failed");
  });

  it("abgelehnt: 403 denied, abgelaufen: 410 expired, auch wenn schon freigegeben", async () => {
    findRequestByDeviceCode.mockResolvedValue({ id: "r", status: "denied", user_id: "u", expires_at: future(), last_polled_at: null });
    const denied = await POST(post({ deviceCode }));
    expect(denied.status).toBe(403);
    expect(await kind(denied)).toBe("denied");

    findRequestByDeviceCode.mockResolvedValue({
      id: "r",
      status: "approved",
      user_id: "u",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      last_polled_at: null,
    });
    const expired = await POST(post({ deviceCode }));
    expect(expired.status).toBe(410);
    expect(await kind(expired)).toBe("expired");
    expect(claimApprovedRequest).not.toHaveBeenCalled();
  });

  it("ein falscher, ein unbekannter und ein schon abgeholter Code geben dieselbe 400, nie eine Sitzung", async () => {
    const malformed = await POST(post({ deviceCode: "kurz" }));
    findRequestByDeviceCode.mockResolvedValue(null);
    const unknown = await POST(post({ deviceCode }));
    findRequestByDeviceCode.mockResolvedValue({ id: "r", status: "consumed", user_id: "u", expires_at: future(), last_polled_at: null });
    const consumed = await POST(post({ deviceCode }));

    for (const res of [malformed, unknown, consumed]) {
      expect(res.status).toBe(400);
      expect(await kind(res)).toBe("invalid");
    }
    expect(issueCliSession).not.toHaveBeenCalled();
    // Die Datenbank wird für einen falsch geformten Code gar nicht erst gefragt.
    expect(findRequestByDeviceCode).toHaveBeenCalledTimes(2);
  });

  it("antwortet 503, wenn die Datenbank nicht antwortet", async () => {
    findRequestByDeviceCode.mockRejectedValue(new Error("down"));
    expect((await POST(post({ deviceCode }))).status).toBe(503);
  });
});

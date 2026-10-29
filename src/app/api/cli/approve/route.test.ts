import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
const findPendingRequest = vi.fn();
const decideRequest = vi.fn();
vi.mock("@/server/cli-login/store", () => ({
  findPendingRequest: (...a: unknown[]) => findPendingRequest(...a),
  decideRequest: (...a: unknown[]) => decideRequest(...a),
}));

import { POST } from "./route";

let counter = 0;
let currentUser = "";

function post(
  body: unknown,
  { origin = "https://promptprinter.app", headers = {} as Record<string, string> } = {}
) {
  return new Request("https://promptprinter.app/api/cli/approve", {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}), ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app");
  // Ein eigener Nutzer je Test: das Ratenlimit (im Speicher, ohne Upstash) zählt je Nutzer.
  counter += 1;
  currentUser = `user-${counter}`;
  getUser.mockResolvedValue({ data: { user: { id: currentUser } } });
  findPendingRequest.mockResolvedValue({ clientName: "pp auf Laptop", createdAt: "2026-10-29T10:00:00Z" });
  decideRequest.mockResolvedValue(true);
});

describe("POST /api/cli/approve", () => {
  it("lookup zeigt Gerätename und Zeit, ohne etwas zu entscheiden", async () => {
    const res = await POST(post({ userCode: "bcdf-ghjk", action: "lookup" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientName: "pp auf Laptop", createdAt: "2026-10-29T10:00:00Z" });
    expect(findPendingRequest).toHaveBeenCalledWith("BCDFGHJK");
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("approve und deny entscheiden für genau diesen Nutzer", async () => {
    const approved = await POST(post({ userCode: "BCDFGHJK", action: "approve" }));
    expect(approved.status).toBe(200);
    expect(await approved.json()).toEqual({ ok: true, status: "approved" });
    expect(decideRequest).toHaveBeenLastCalledWith("BCDFGHJK", currentUser, "approved");

    await POST(post({ userCode: "BCDFGHJK", action: "deny" }));
    expect(decideRequest).toHaveBeenLastCalledWith("BCDFGHJK", currentUser, "denied");
  });

  it("ein fremder oder fehlender Origin ergibt 403, bevor irgendetwas geprüft oder geändert wird", async () => {
    for (const origin of ["https://evil.example", ""]) {
      const res = await POST(post({ userCode: "BCDFGHJK", action: "approve" }, { origin }));
      expect(res.status, `Origin "${origin}"`).toBe(403);
      expect((await res.json()).kind).toBe("origin");
    }
    expect(getUser).not.toHaveBeenCalled();
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("ohne Sitzung ergibt 401, und ein mitgeschickter Bearer-Kopf ersetzt das Cookie nicht", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(
      post({ userCode: "BCDFGHJK", action: "approve" }, { headers: { authorization: "Bearer some-cli-token" } })
    );
    expect(res.status).toBe(401);
    expect(decideRequest).not.toHaveBeenCalled();
  });

  it("falsche Form, unbekannter und abgelaufener Code geben dieselbe 404", async () => {
    const wrongShape = await POST(post({ userCode: "BCDFGHJA", action: "approve" }));
    findPendingRequest.mockResolvedValue(null);
    decideRequest.mockResolvedValue(false);
    const unknownLookup = await POST(post({ userCode: "BCDFGHJK", action: "lookup" }));
    const unknownApprove = await POST(post({ userCode: "BCDFGHJK", action: "approve" }));

    for (const res of [wrongShape, unknownLookup, unknownApprove]) {
      expect(res.status).toBe(404);
      expect((await res.json()).kind).toBe("not_found");
    }
  });

  it("die elfte Anfrage in einer Minute bekommt 429, die zehn davor gehen durch", async () => {
    for (let i = 1; i <= 10; i += 1) {
      const res = await POST(post({ userCode: "BCDFGHJK", action: "lookup" }));
      expect(res.status, `Anfrage ${i}`).toBe(200);
    }
    const eleventh = await POST(post({ userCode: "BCDFGHJK", action: "lookup" }));
    expect(eleventh.status).toBe(429);
    expect((await eleventh.json()).retryAfter).toBeGreaterThan(0);

    // Ein anderer Nutzer hat seinen eigenen Zähler.
    getUser.mockResolvedValue({ data: { user: { id: `${currentUser}-other` } } });
    expect((await POST(post({ userCode: "BCDFGHJK", action: "lookup" }))).status).toBe(200);
  });

  it("weist eine unbekannte Aktion und einen kaputten Rumpf mit 400 ab", async () => {
    expect((await POST(post({ userCode: "BCDFGHJK", action: "delete" }))).status).toBe(400);
    expect((await POST(post({ action: "lookup" }))).status).toBe(400);
  });

  it("antwortet 503, wenn die Datenbank nicht antwortet", async () => {
    decideRequest.mockRejectedValue(new Error("down"));
    const res = await POST(post({ userCode: "BCDFGHJK", action: "approve" }));
    expect(res.status).toBe(503);
  });
});

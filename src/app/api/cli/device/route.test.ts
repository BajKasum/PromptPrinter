import { beforeEach, describe, expect, it, vi } from "vitest";

const createDeviceRequest = vi.fn();
vi.mock("@/server/cli-login/store", () => ({
  createDeviceRequest: (...a: unknown[]) => createDeviceRequest(...a),
}));
const rateLimit = vi.fn();
vi.mock("@/server/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security/rate-limit")>();
  return { ...actual, rateLimit: (...a: unknown[]) => rateLimit(...a) };
});

import { POST } from "./route";

function post(body: unknown, raw?: string) {
  return new Request("https://promptprinter.app/api/cli/device", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://promptprinter.app");
  rateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetAt: Date.now() + 1000 });
  createDeviceRequest.mockResolvedValue({
    deviceCode: "D".repeat(43),
    userCode: "BCDFGHJK",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
});

describe("POST /api/cli/device", () => {
  it("gibt Geräte-Code, formatierten Nutzer-Code, Adresse ohne Code und Pause zurück", async () => {
    const res = await POST(post({ clientName: "  pp auf  Laptop " }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    expect(json).toEqual({
      deviceCode: "D".repeat(43),
      userCode: "BCDF-GHJK",
      verificationUri: "https://promptprinter.app/cli",
      expiresIn: 600,
      interval: 5,
    });
    // Die Adresse trägt keinen Code: ein vorausgefüllter Link würde Unterschiebungen erleichtern.
    expect(json.verificationUri).not.toMatch(/[?#=]|BCDF/);
    expect(createDeviceRequest).toHaveBeenCalledWith("pp auf Laptop");
  });

  it("zählt gegen den Bereich cli-device je Adresse und weist darüber hinaus mit 429 ab, bevor es etwas anlegt", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });
    const res = await POST(post({}));

    expect(res.status).toBe(429);
    expect((await res.json()).retryAfter).toBeGreaterThan(0);
    expect(rateLimit.mock.calls[0][0]).toBe("cli-device:ip:203.0.113.7");
    expect(createDeviceRequest).not.toHaveBeenCalled();
  });

  it("weist kaputtes JSON, einen zu langen Namen und einen falschen Rumpf mit 400 ab", async () => {
    expect((await POST(post(null, "{nope"))).status).toBe(400);
    expect((await POST(post({ clientName: "x".repeat(201) }))).status).toBe(400);
    expect((await POST(post(["clientName"]))).status).toBe(400);
    expect(createDeviceRequest).not.toHaveBeenCalled();
  });

  it("antwortet 503 mit kind unavailable, wenn die Datenbank nicht antwortet (zum Beispiel Migration fehlt)", async () => {
    createDeviceRequest.mockRejectedValue(new Error("relation does not exist"));
    const res = await POST(post({}));
    expect(res.status).toBe(503);
    expect((await res.json()).kind).toBe("unavailable");
  });
});

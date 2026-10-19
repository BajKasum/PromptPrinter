import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";

const getUser = vi.fn();
const rateLimit = vi.fn();
const setZaiConsent = vi.fn();
const captureError = vi.fn();

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: (_req: Request, scope: string, userId?: string) => `${scope}:u:${userId}`,
}));
vi.mock("@/server/consent", () => ({ setZaiConsent: (...a: unknown[]) => setZaiConsent(...a) }));
vi.mock("@/shared/lib/observability", () => ({
  captureError: (...a: unknown[]) => captureError(...a),
  logWarning: vi.fn(),
}));

const req = (method: string, body?: unknown) =>
  new Request("https://promptprinter.app/api/consent/zai", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("/api/consent/zai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetAt: Date.now() + 1000 });
    setZaiConsent.mockResolvedValue(undefined);
  });

  it("POST erteilt die Zustimmung für das Konto der Sitzung", async () => {
    const res = await POST(req("POST"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, granted: true });
    expect(setZaiConsent).toHaveBeenCalledWith("user-1", true);
  });

  it("DELETE widerruft sie", async () => {
    const res = await DELETE(req("DELETE"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, granted: false });
    expect(setZaiConsent).toHaveBeenCalledWith("user-1", false);
  });

  it("nimmt die Kennung nie aus dem Körper: niemand stimmt für ein anderes Konto zu", async () => {
    await POST(req("POST", { userId: "user-2" }));

    expect(setZaiConsent).toHaveBeenCalledWith("user-1", true);
    expect(setZaiConsent).not.toHaveBeenCalledWith("user-2", expect.anything());
  });

  it("ohne Sitzung: 401, nichts geschrieben", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    for (const call of [POST, DELETE]) {
      const res = await call(req("POST"));
      expect(res.status).toBe(401);
    }
    expect(setZaiConsent).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("Ratenlimit erreicht: 429, nichts geschrieben", async () => {
    rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5000 });

    const res = await POST(req("POST"));

    expect(res.status).toBe(429);
    expect(setZaiConsent).not.toHaveBeenCalled();
  });

  it("scheitert das Speichern: 503 und kein stiller Erfolg", async () => {
    setZaiConsent.mockRejectedValue(new Error("auth down"));

    const res = await POST(req("POST"));

    expect(res.status).toBe(503);
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});

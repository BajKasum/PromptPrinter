import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
let ownerRow: { data: unknown; error: unknown } = { data: null, error: null };
const ownerCalls: unknown[][] = [];
vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = (...a: unknown[]) => (ownerCalls.push(a), c);
      c.maybeSingle = async () => ownerRow;
      return c;
    },
  }),
}));

const rateLimit = vi.fn();
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
  rateLimitKey: (_req: unknown, scope: string, user?: string) => `${scope}:u:${user}`,
}));

const recordSecurityEvent = vi.fn();
vi.mock("@/server/security/security-events", () => ({ recordSecurityEvent: (...a: unknown[]) => recordSecurityEvent(...a) }));

const createShare = vi.fn();
const revokeShare = vi.fn();
const shareTokenFor = vi.fn();
vi.mock("@/server/prompt-share", () => ({
  createShare: (...a: unknown[]) => createShare(...a),
  revokeShare: (...a: unknown[]) => revokeShare(...a),
  shareTokenFor: (...a: unknown[]) => shareTokenFor(...a),
}));

import { DELETE, GET, POST } from "./route";

const PROMPT = "33333333-3333-4333-8333-333333333333";
const ctx = (id = PROMPT) => ({ params: Promise.resolve({ id }) });
const req = (method: string) => new Request(`https://promptprinter.app/api/prompts/${PROMPT}/share`, { method });

describe("/api/prompts/[id]/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownerCalls.length = 0;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() });
    ownerRow = { data: { id: PROMPT }, error: null };
  });

  it("verlangt eine Sitzung", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req("POST"), ctx())).status).toBe(401);
    expect(createShare).not.toHaveBeenCalled();
  });

  it("antwortet 404 auf eine kaputte Kennung und auf einen fremden Prompt", async () => {
    expect((await POST(req("POST"), ctx("nicht-uuid"))).status).toBe(404);
    ownerRow = { data: null, error: null };
    expect((await POST(req("POST"), ctx())).status).toBe(404);
    expect(createShare).not.toHaveBeenCalled();
    // Der Eigentümer wird über die Sitzung UND user_id geprüft.
    expect(ownerCalls).toContainEqual(["user_id", "u1"]);
  });

  it("teilt, protokolliert nur eine neue Freigabe und liefert das Token", async () => {
    createShare.mockResolvedValue({ token: "t".repeat(32), created: true });
    const res = await POST(req("POST"), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "t".repeat(32) });
    expect(createShare).toHaveBeenCalledWith("u1", PROMPT);
    expect(recordSecurityEvent).toHaveBeenCalledWith("prompt.shared", "u1", { promptId: PROMPT });

    recordSecurityEvent.mockClear();
    createShare.mockResolvedValue({ token: "t".repeat(32), created: false });
    await POST(req("POST"), ctx());
    expect(recordSecurityEvent).not.toHaveBeenCalled();
  });

  it("nennt den Stand und widerruft", async () => {
    shareTokenFor.mockResolvedValue(null);
    expect(await (await GET(req("GET"), ctx())).json()).toEqual({ token: null });

    revokeShare.mockResolvedValue(true);
    const res = await DELETE(req("DELETE"), ctx());
    expect(await res.json()).toEqual({ token: null });
    expect(revokeShare).toHaveBeenCalledWith("u1", PROMPT);
    expect(recordSecurityEvent).toHaveBeenCalledWith("prompt.unshared", "u1", { promptId: PROMPT });
  });

  it("bremst mit dem Ratenlimit und antwortet 503, wenn die Datenbank nicht mitspielt", async () => {
    rateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 });
    expect((await POST(req("POST"), ctx())).status).toBe(429);

    rateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() });
    createShare.mockRejectedValue(new Error("down"));
    expect((await POST(req("POST"), ctx())).status).toBe(503);
  });
});

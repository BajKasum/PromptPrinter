import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const isRepoStale = vi.fn();
const eqCalls: [string, unknown][] = [];
let row: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/server/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return chain;
        },
        maybeSingle: async () => row,
      };
      return chain;
    },
  }),
}));
const rateLimit = vi.fn();
vi.mock("@/server/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  rateLimitKey: (_req: unknown, scope: string, userId: string) => `${scope}:u:${userId}`,
}));
vi.mock("@/server/brain/repo-status", () => ({ isRepoStale: (...args: unknown[]) => isRepoStale(...args) }));
vi.mock("@/shared/lib/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/observability")>()), captureError: vi.fn(), logEvent: vi.fn(), logWarning: vi.fn() }));

import { GET } from "./route";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const call = (id = PROJECT) =>
  GET(new Request(`http://localhost/api/projects/${id}/brain/status`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  isRepoStale.mockReset().mockResolvedValue(true);
  rateLimit.mockReset().mockResolvedValue({ allowed: true, resetAt: 0 });
  eqCalls.length = 0;
  row = { data: { status: "ready", repo_url: "https://github.com/o/r", repo_ref: "a".repeat(40) }, error: null };
});

describe("GET /api/projects/[id]/brain/status", () => {
  it("fragt GitHub über der Stundengrenze nicht und meldet 'unbekannt'", async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false, resetAt: Date.now() + 1000 });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stale: null });
    expect(isRepoStale).not.toHaveBeenCalled();
  });

  it("verlangt eine Sitzung", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await call()).status).toBe(401);
    expect(isRepoStale).not.toHaveBeenCalled();
  });

  it("liest nur die eigene Zeile des Projekts", async () => {
    await call();
    expect(eqCalls).toContainEqual(["project_id", PROJECT]);
    expect(eqCalls).toContainEqual(["user_id", "user-1"]);
  });

  it("gibt das Ergebnis des Vergleichs weiter und erlaubt keinen Zwischenspeicher im Browser", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ stale: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(isRepoStale).toHaveBeenCalledWith("https://github.com/o/r", "a".repeat(40), expect.anything());
    isRepoStale.mockResolvedValue(false);
    expect(await (await call()).json()).toEqual({ stale: false });
  });

  it("antwortet 'unbekannt' für ein fremdes oder fehlendes Projekt, ohne GitHub zu fragen", async () => {
    row = { data: null, error: null };
    expect(await (await call()).json()).toEqual({ stale: null });
    expect(isRepoStale).not.toHaveBeenCalled();
  });

  it("fragt GitHub nicht, solange die Analyse nicht fertig ist", async () => {
    row = { data: { status: "analyzing", repo_url: "https://github.com/o/r", repo_ref: "a".repeat(40) }, error: null };
    expect(await (await call()).json()).toEqual({ stale: null });
    expect(isRepoStale).not.toHaveBeenCalled();
  });

  it("liest einen Datenbankfehler nicht als 'unbekannt', sondern meldet 503", async () => {
    row = { data: null, error: { message: "boom" } };
    expect((await call()).status).toBe(503);
  });

  it("lehnt eine Projekt-Kennung ab, die keine UUID ist, ohne die Datenbank zu fragen", async () => {
    expect((await call("../../x")).status).toBe(404);
    expect(eqCalls).toEqual([]);
  });
});

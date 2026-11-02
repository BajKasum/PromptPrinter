import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Eine Absage des Ratenlimits gehört ins Sicherheitsprotokoll (jede zehnte). Eigene Datei, weil der Zweig ohne Redis die
// Module neu lädt und die Zufallszahl festlegt.

const logRateLimited = vi.fn();
vi.mock("@/server/security/security-log", () => ({
  logRateLimited: (...a: unknown[]) => logRateLimited(...a),
}));

async function freshRateLimit() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.resetModules();
  return (await import("@/server/security/rate-limit")).rateLimit;
}

beforeEach(() => {
  logRateLimited.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rateLimit und das Sicherheitsprotokoll", () => {
  it("meldet eine Absage mit dem Schlüssel, und nichts, solange die Anfrage durchgeht", async () => {
    const rateLimit = await freshRateLimit();
    const ceiling = { limit: 1, windowMs: 60_000 };

    expect((await rateLimit("projects:u:user-1", ceiling)).allowed).toBe(true);
    expect(logRateLimited).not.toHaveBeenCalled();

    expect((await rateLimit("projects:u:user-1", ceiling)).allowed).toBe(false);
    expect(logRateLimited).toHaveBeenCalledExactlyOnceWith("projects:u:user-1");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

// Security-Audit finding M-4: the container healthcheck used to GET "/", the
// marketing page, which renders from static output regardless of whether the
// backend is reachable — so a broken deployment reported healthy.

const originalEnv = { ...process.env };

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

function setAllRequired() {
  for (const name of REQUIRED) process.env[name] = "set";
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("GET /api/health", () => {
  it("reports ok when every load-bearing variable is present", async () => {
    setAllRequired();
    const res = GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it.each(REQUIRED)("fails the probe with 503 when %s is missing", async (missing) => {
    setAllRequired();
    delete process.env[missing];

    const res = GET();

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "degraded" });
  });

  it("treats a blank value as missing", async () => {
    setAllRequired();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "   ";
    expect(GET().status).toBe(503);
  });

  // The endpoint is unauthenticated by necessity, so it must not become a
  // reconnaissance tool: no versions, no hostnames, no provider names, and no
  // hint about WHICH variable is missing.
  it("never reveals which configuration is missing", async () => {
    setAllRequired();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const body = (await GET().json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["status"]);
    expect(JSON.stringify(body)).not.toContain("SUPABASE");
  });

  it("is never cached, so a probe always sees current state", () => {
    setAllRequired();
    expect(GET().headers.get("cache-control")).toBe("no-store");
  });
});

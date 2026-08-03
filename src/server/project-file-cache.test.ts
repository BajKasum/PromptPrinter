import { afterEach, describe, expect, it, vi } from "vitest";

// Same fresh-module-per-test pattern as rate-limit.test.ts: the module-level
// `redis` client is resolved from process.env at import time.
describe("getCachedFileContent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@upstash/redis");
    vi.resetModules();
  });

  it("always calls download when Upstash isn't configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { getCachedFileContent } = await import("@/server/project-file-cache");

    const download = vi.fn().mockResolvedValue("hello");
    expect(await getCachedFileContent("path/a", download)).toBe("hello");
    expect(await getCachedFileContent("path/a", download)).toBe("hello");
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("downloads once and serves the cache on a second call for the same path", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const store = new Map<string, string>();
    const get = vi.fn(async (key: string) => store.get(key) ?? null);
    const set = vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    });
    vi.doMock("@upstash/redis", () => ({ Redis: { fromEnv: () => ({ get, set }) } }));
    vi.resetModules();
    const { getCachedFileContent } = await import("@/server/project-file-cache");

    const download = vi.fn().mockResolvedValue("file content");
    expect(await getCachedFileContent("path/a", download)).toBe("file content");
    expect(await getCachedFileContent("path/a", download)).toBe("file content");
    expect(download).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("promptprinter/project-file:path/a", "file content", {
      ex: 60 * 60,
    });
  });

  it("does not cache a null (download failure) result", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const set = vi.fn();
    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: () => ({ get: vi.fn().mockResolvedValue(null), set }) },
    }));
    vi.resetModules();
    const { getCachedFileContent } = await import("@/server/project-file-cache");

    const download = vi.fn().mockResolvedValue(null);
    expect(await getCachedFileContent("path/missing", download)).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it("degrades to an uncached download when Redis errors on read", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.doMock("@upstash/redis", () => ({
      Redis: {
        fromEnv: () => ({
          get: vi.fn().mockRejectedValue(new Error("down")),
          set: vi.fn().mockRejectedValue(new Error("down")),
        }),
      },
    }));
    vi.resetModules();
    const { getCachedFileContent } = await import("@/server/project-file-cache");

    const download = vi.fn().mockResolvedValue("still works");
    expect(await getCachedFileContent("path/a", download)).toBe("still works");
  });
});

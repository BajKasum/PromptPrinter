import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Antwortet wie die REST-Schnittstelle von Upstash: ein Befehl an der Wurzel, mehrere gebündelt unter /pipeline (der
 * Client bündelt von sich aus). Gespeichert wird der Wert so, wie er ankommt, wie Redis es tut.
 */
function fakeUpstashFetch() {
  const store = new Map<string, string>();
  const run = ([name, key, value]: unknown[]) => {
    switch (String(name).toLowerCase()) {
      case "set":
        store.set(String(key), String(value));
        return { result: "OK" };
      case "get":
        return { result: store.get(String(key)) ?? null };
      default:
        return { error: `ERR unknown command '${String(name)}'` };
    }
  };
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as unknown;
    const reply = String(url).endsWith("/pipeline") ? (body as unknown[][]).map(run) : run(body as unknown[]);
    return new Response(JSON.stringify(reply), { headers: { "content-type": "application/json" } });
  });
}

// Same fresh-module-per-test pattern as rate-limit.test.ts: the module-level
// `redis` client is resolved from process.env at import time.
describe("getCachedFileContent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock("@upstash/redis");
    vi.resetModules();
  });

  // Der echte Client gegen die nachgestellte Schnittstelle, keine Map: mit seiner Voreinstellung wertet er jede
  // Antwort aus, die sich als JSON lesen lässt. Eine Map gibt den String unverändert zurück und sieht das nie.
  it.each([
    ["package.json", '{\n  "name": "demo",\n  "private": true\n}'],
    ["zahl.txt", "42"],
    ["liste.json", '["a", "b"]'],
    ["notes.md", "# Notizen"],
  ])("liefert %s beim zweiten Zug als denselben Text aus dem Cache", async (name, text) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const upstash = fakeUpstashFetch();
    vi.stubGlobal("fetch", upstash);
    vi.resetModules();
    const { getCachedFileContent } = await import("@/server/project-file-cache");

    const download = vi.fn().mockResolvedValue(text);
    expect(await getCachedFileContent(`u/p/${name}`, download)).toBe(text);
    expect(await getCachedFileContent(`u/p/${name}`, download)).toBe(text);
    expect(download).toHaveBeenCalledTimes(1);
    expect(upstash).toHaveBeenCalled();
  });

  it("lädt neu, wenn aus dem Cache etwas anderes als Text kommt", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.doMock("@upstash/redis", () => ({
      Redis: {
        fromEnv: () => ({ get: vi.fn().mockResolvedValue({ name: "demo" }), set: vi.fn().mockResolvedValue("OK") }),
      },
    }));
    vi.resetModules();
    const { getCachedFileContent } = await import("@/server/project-file-cache");

    const download = vi.fn().mockResolvedValue('{"name":"demo"}');
    expect(await getCachedFileContent("u/p/package.json", download)).toBe('{"name":"demo"}');
    expect(download).toHaveBeenCalledTimes(1);
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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #244: hat sich das analysierte Repo geändert? Gegen ein gemocktes GitHub, gleich, anders, 404, Limit,
// Zeitüberschreitung, Netzfehler, und: wie viele Anfragen kostet eine Prüfung.

const store = new Map<string, string>();
const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("@/server/security/redis-client", () => ({ redis: redisMock }));

const OLD = "a".repeat(40);
const NEW = "b".repeat(40);
const fetchMock = vi.fn();

function treeResponse(sha: unknown, status = 200, headers: Record<string, string> = {}) {
  return { ok: status < 400, status, headers: new Headers(headers), json: async () => ({ sha, tree: [] }) };
}

async function load() {
  vi.resetModules();
  return import("@/server/brain/repo-status");
}

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  redisMock.get.mockReset().mockImplementation(async (key: string) => store.get(key) ?? null);
  redisMock.set.mockReset().mockImplementation(async (key: string, value: string) => void store.set(key, value));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("isRepoStale", () => {
  it("meldet 'nicht veraltet', wenn die Baum-SHA gleich ist", async () => {
    fetchMock.mockResolvedValue(treeResponse(OLD));
    const { isRepoStale } = await load();
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBe(false);
  });

  it("meldet 'veraltet', wenn es einen neuen Stand gibt", async () => {
    fetchMock.mockResolvedValue(treeResponse(NEW));
    const { isRepoStale } = await load();
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBe(true);
  });

  it("kostet genau eine Anfrage an api.github.com, ohne rekursiven Baum", async () => {
    fetchMock.mockResolvedValue(treeResponse(NEW));
    const { isRepoStale } = await load();
    await isRepoStale("https://github.com/o/r", OLD);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/o/r/git/trees/HEAD");
  });

  it("fragt GitHub nicht noch einmal, solange die SHA im Zwischenspeicher steht", async () => {
    fetchMock.mockResolvedValue(treeResponse(NEW));
    const { isRepoStale } = await load();
    await isRepoStale("https://github.com/o/r", OLD);
    expect(await isRepoStale("https://github.com/O/R", OLD)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(expect.stringContaining("o/r"), NEW, { ex: 300 });
  });

  it.each([
    ["Repo gelöscht oder privat (404)", () => treeResponse(undefined, 404)],
    ["Limit erreicht", () => treeResponse(undefined, 403, { "x-ratelimit-remaining": "0" })],
    ["GitHub-Fehler (500)", () => treeResponse(undefined, 500)],
    ["Antwort ohne SHA", () => treeResponse(undefined)],
    ["Antwort mit einer SHA falscher Form", () => treeResponse("main")],
  ])("bleibt bei '%s' still (null)", async (_name, response) => {
    fetchMock.mockResolvedValue(response());
    const { isRepoStale } = await load();
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBeNull();
  });

  it("bleibt bei Netzfehler und Zeitüberschreitung still", async () => {
    const { isRepoStale } = await load();
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBeNull();
    store.clear();
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBeNull();
  });

  it("merkt sich einen Fehlschlag kurz und fragt dann nicht bei jedem Aufruf neu", async () => {
    fetchMock.mockResolvedValue(treeResponse(undefined, 403, { "x-ratelimit-remaining": "0" }));
    const { isRepoStale } = await load();
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBeNull();
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(expect.any(String), "!", { ex: 60 });
  });

  it("vergleicht nichts, wenn nichts zu vergleichen ist, und fragt GitHub dann gar nicht", async () => {
    const { isRepoStale } = await load();
    expect(await isRepoStale(null, OLD)).toBeNull();
    expect(await isRepoStale("https://github.com/o/r", null)).toBeNull();
    // Ein Eintrag aus der Zeit vor M-13 trägt den Branch-Namen statt einer SHA.
    expect(await isRepoStale("https://github.com/o/r", "main")).toBeNull();
    expect(await isRepoStale("https://evil.example/o/r", OLD)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("läuft auch, wenn Redis nicht antwortet", async () => {
    redisMock.get.mockRejectedValue(new Error("down"));
    redisMock.set.mockRejectedValue(new Error("down"));
    fetchMock.mockResolvedValue(treeResponse(NEW));
    const { isRepoStale } = await load();
    expect(await isRepoStale("https://github.com/o/r", OLD)).toBe(true);
  });
});

describe("das Workspace-Layout", () => {
  const layout = readFileSync(join(process.cwd(), "src/app/(app)/projects/[id]/(workspace)/layout.tsx"), "utf8");

  it("macht keinen GitHub-Aufruf und kennt die Prüfroute nicht", () => {
    expect(layout).not.toMatch(/brain\/github|repo-status|brain\/status|api\.github\.com|fetchRepoHeadSha/);
  });
});

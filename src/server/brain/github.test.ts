import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GithubImportError,
  fetchRepoSnapshot,
  parseGithubRepoUrl,
  selectSignalFiles,
  summarizeTree,
} from "@/server/brain/github";

describe("parseGithubRepoUrl", () => {
  it("accepts the forms a person actually pastes", () => {
    for (const input of [
      "https://github.com/vercel/next.js",
      "http://github.com/vercel/next.js",
      "https://www.github.com/vercel/next.js",
      "github.com/vercel/next.js",
      "https://github.com/vercel/next.js.git",
      "git@github.com:vercel/next.js.git",
      "vercel/next.js",
      "  https://github.com/vercel/next.js/  ",
    ]) {
      expect(parseGithubRepoUrl(input), input).toEqual({
        owner: "vercel",
        repo: "next.js",
        url: "https://github.com/vercel/next.js",
      });
    }
  });

  it("throws away everything after owner/repo instead of interpreting it", () => {
    expect(parseGithubRepoUrl("https://github.com/vercel/next.js/tree/canary/packages")).toEqual({
      owner: "vercel",
      repo: "next.js",
      url: "https://github.com/vercel/next.js",
    });
  });

  // Das ist der eigentliche Sicherheitstest dieser Funktion: ihr Ergebnis
  // bestimmt, welche URL der Server gleich aufruft. Was hier durchkaeme,
  // waere die naechste SSRF-Luecke (vgl. Kritik-Pass S-1).
  it("refuses anything that is not github.com", () => {
    for (const input of [
      "https://evil.com/vercel/next.js",
      "http://169.254.169.254/latest/meta-data",
      "https://github.com.evil.com/vercel/next.js",
      "evil.com/vercel/next.js",
      "file:///etc/passwd",
      "//evil.com/vercel/next.js",
      "https://localhost/a/b",
      "git@evil.com:vercel/next.js",
      "javascript:alert(1)//a/b",
    ]) {
      expect(parseGithubRepoUrl(input), input).toBeNull();
    }
  });

  it("refuses names outside GitHub's own alphabet", () => {
    for (const input of [
      "vercel",
      "",
      "   ",
      "vercel/",
      "/next.js",
      "ver cel/next.js",
      "../../etc/passwd",
      "-vercel/next.js",
      `${"a".repeat(120)}/repo`,
      `owner/${"b".repeat(120)}`,
      `https://github.com/${"x".repeat(400)}/y`,
    ]) {
      expect(parseGithubRepoUrl(input), input).toBeNull();
    }
  });

  it("never returns a url it did not build itself", () => {
    // Selbst wenn die Eingabe Unsinn hinter dem Repo traegt, ist die
    // kanonische URL neu zusammengesetzt, nicht durchgereicht.
    const ref = parseGithubRepoUrl("https://github.com/owner/repo?x=1#y");
    expect(ref?.url).toBe("https://github.com/owner/repo");
  });
});

describe("selectSignalFiles", () => {
  it("prefers manifests over prose, in that order", () => {
    const chosen = selectSignalFiles(["README.md", "tsconfig.json", "package.json"]);
    expect(chosen[0]).toBe("package.json");
    expect(chosen.indexOf("tsconfig.json")).toBeLessThan(chosen.indexOf("README.md"));
  });

  it("prefers the root copy over a nested one of the same name", () => {
    const chosen = selectSignalFiles(["apps/web/package.json", "package.json"]);
    expect(chosen[0]).toBe("package.json");
  });

  // Beim ersten echten Lauf gegen dieses Repo gingen 5 von 14 Plaetzen an
  // README.md-Dateien aus .claude/skills/*/ui_kits/* — fuenf Beschreibungen
  // desselben UI-Kits, die ueber den Stack nichts sagten und Dateien
  // verdraengten, die etwas gesagt haetten.
  it("does not let one filename eat the whole budget", () => {
    const chosen = selectSignalFiles([
      "README.md",
      "a/README.md",
      "b/README.md",
      "c/README.md",
      "d/README.md",
      "package.json",
      "tsconfig.json",
    ]);
    expect(chosen.filter((p) => p.toLowerCase().endsWith("readme.md"))).toHaveLength(2);
    expect(chosen).toContain("package.json");
    expect(chosen).toContain("tsconfig.json");
  });

  // Ein Monorepo hat je Workspace ein Manifest; genau ein zweites soll noch
  // mitkommen.
  it("still keeps a second manifest for the monorepo case", () => {
    const chosen = selectSignalFiles(["package.json", "apps/web/package.json", "apps/api/package.json"]);
    expect(chosen).toEqual(["package.json", "apps/api/package.json"]);
  });

  it("respects the overall cap", () => {
    const paths = Array.from({ length: 40 }, (_, i) => `pkg${i}/tsconfig.json`);
    expect(selectSignalFiles(paths, 14).length).toBeLessThanOrEqual(14);
  });

  it("returns nothing when a repo carries no signal files at all", () => {
    expect(selectSignalFiles(["src/index.rb", "lib/thing.rb"])).toEqual([]);
  });
});

describe("summarizeTree", () => {
  it("condenses paths into directory shape and file types", () => {
    const summary = summarizeTree([
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/features/chat/chat.tsx",
      "package.json",
    ]);
    expect(summary).toContain("src/app (2)");
    expect(summary).toContain("src/features (1)");
    expect(summary).toContain("(root) (1)");
    expect(summary).toContain(".tsx 3");
  });

  it("stays within its budget for a large repo", () => {
    const paths = Array.from({ length: 5000 }, (_, i) => `dir${i % 300}/sub/file${i}.ts`);
    expect(summarizeTree(paths).length).toBeLessThanOrEqual(2000);
  });

  it("handles files without an extension", () => {
    expect(() => summarizeTree(["Dockerfile", "LICENSE"])).not.toThrow();
  });
});

describe("fetchRepoSnapshot", () => {
  const ref = { owner: "acme", repo: "app", url: "https://github.com/acme/app" };
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
    return {
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      headers: new Headers(init.headers ?? {}),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  function textResponse(text: string, status = 200) {
    return {
      ok: status < 400,
      status,
      headers: new Headers(),
      text: async () => text,
    } as unknown as Response;
  }

  it("reads metadata, tree and the signal files", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          default_branch: "main",
          description: "An app",
          language: "TypeScript",
          topics: ["nextjs"],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          tree: [
            { path: "package.json", type: "blob" },
            { path: "README.md", type: "blob" },
            { path: "src/app/page.tsx", type: "blob" },
            { path: "node_modules/left-pad/index.js", type: "blob" },
            { path: "src", type: "tree" },
          ],
        })
      )
      .mockResolvedValue(textResponse('{"name":"app"}'));

    const snapshot = await fetchRepoSnapshot(ref);

    expect(snapshot.primaryLanguage).toBe("TypeScript");
    expect(snapshot.defaultBranch).toBe("main");
    expect(snapshot.topics).toEqual(["nextjs"]);
    // node_modules und Verzeichniseintraege zaehlen nicht mit.
    expect(snapshot.fileCount).toBe(3);
    expect(snapshot.files.map((f) => f.path).sort()).toEqual(["README.md", "package.json"]);
  });

  // Nur die ersten beiden Requests duerfen gegen api.github.com laufen (60/h
  // unauthentifiziert), die Dateien kommen vom CDN. Geht das kaputt, sinkt
  // das Kontingent von ~30 Analysen/Stunde auf ~4.
  it("spends only two calls on the rate-limited API host", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(
        jsonResponse({
          tree: [
            { path: "package.json", type: "blob" },
            { path: "tsconfig.json", type: "blob" },
            { path: "README.md", type: "blob" },
          ],
        })
      )
      .mockResolvedValue(textResponse("{}"));

    await fetchRepoSnapshot(ref);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((u) => u.startsWith("https://api.github.com/"))).toHaveLength(2);
    expect(urls.filter((u) => u.startsWith("https://raw.githubusercontent.com/"))).toHaveLength(3);
    expect(urls.every((u) => /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//.test(u))).toBe(
      true
    );
  });

  it("maps a missing repo to a stable code", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, { status: 404 }));
    await expect(fetchRepoSnapshot(ref)).rejects.toMatchObject({ code: "repo_not_found" });
  });

  it("tells an exhausted rate limit apart from a private repo", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } })
    );
    await expect(fetchRepoSnapshot(ref)).rejects.toMatchObject({ code: "repo_rate_limited" });

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({}, { status: 403, headers: { "x-ratelimit-remaining": "58" } })
    );
    await expect(fetchRepoSnapshot(ref)).rejects.toMatchObject({ code: "repo_not_found" });
  });

  it("reports an empty repo instead of analysing nothing", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(jsonResponse({ tree: [] }));
    await expect(fetchRepoSnapshot(ref)).rejects.toMatchObject({ code: "repo_empty" });
  });

  it("turns a transport failure into a stable code, never a raw message", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED 10.0.0.1:443"));
    const error = await fetchRepoSnapshot(ref).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GithubImportError);
    expect((error as GithubImportError).code).toBe("repo_unavailable");
    expect((error as GithubImportError).message).not.toContain("10.0.0.1");
  });

  // Eine fehlende Einzeldatei ist kein Grund, die ganze Analyse zu killen.
  it("skips a file that cannot be read and keeps the rest", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(
        jsonResponse({
          tree: [
            { path: "package.json", type: "blob" },
            { path: "README.md", type: "blob" },
          ],
        })
      )
      .mockResolvedValueOnce(textResponse("{}"))
      .mockResolvedValueOnce(textResponse("nope", 404));

    const snapshot = await fetchRepoSnapshot(ref);
    expect(snapshot.files).toHaveLength(1);
  });
});

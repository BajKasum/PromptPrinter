import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectBrainSources, digestOfSources } from "@/features/projects/lib/brain-sources";

// Das GitHub-Modul wird hier NICHT gemockt, sondern nur `fetch` gestubbt —
// der echte fetchRepoSnapshot laeuft also mit, inklusive parseGithubRepoUrl,
// Signal-Dateiauswahl und Fehlerabbildung.
//
// Das ist nicht nur realistischer, es umgeht auch ein Vitest-Artefakt in
// diesem Setup: ein vi.fn(), dessen Implementierung ablehnt, wird bei
// vorhandenem beforeEach-Hook als unbehandelte Rejection gemeldet, selbst
// wenn der Aufrufer sie nachweislich faengt (mit einer instrumentierten
// Reproduktion geprueft: ein Aufruf, Fehler korrekt gefangen, Test trotzdem
// rot). Ein gestubbtes fetch hat das Problem nicht.

type Row = { id: string; name: string; storage_path: string; size_bytes: number };

function supabaseWith(rows: Row[], download: (path: string) => Blob | null) {
  return {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => Promise.resolve({ data: rows, error: null }),
      };
      return chain;
    },
    storage: {
      from: () => ({
        download: async (path: string) => {
          const blob = download(path);
          return blob ? { data: blob, error: null } : { data: null, error: { message: "gone" } };
        },
      }),
    },
  } as never;
}

function textBlob(text: string): Blob {
  return new Blob([text], { type: "text/plain" });
}

function pngBlob(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "image/png" });
}

/** GitHub-Antworten, wie fetchRepoSnapshot sie nacheinander erwartet. */
function githubResponses(files: string[], status = 200) {
  const json = (body: unknown, s = 200) =>
    ({
      ok: s < 400,
      status: s,
      headers: new Headers(),
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;

  if (status !== 200) return [json({ message: "Not Found" }, status)];

  return [
    json({ default_branch: "main", language: "TypeScript", description: null, topics: [] }),
    json({ tree: files.map((path) => ({ path, type: "blob" })) }),
    ...files.map(
      () =>
        ({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => "{}",
        }) as unknown as Response
    ),
  ];
}

describe("digestOfSources", () => {
  it("changes when a file is added, removed or replaced", () => {
    const base = digestOfSources([{ id: "a", sizeBytes: 10 }], null);
    expect(digestOfSources([{ id: "a", sizeBytes: 10 }], null)).toBe(base);
    expect(digestOfSources([{ id: "a", sizeBytes: 11 }], null)).not.toBe(base);
    expect(digestOfSources([{ id: "a", sizeBytes: 10 }, { id: "b", sizeBytes: 1 }], null)).not.toBe(
      base
    );
    expect(digestOfSources([], null)).not.toBe(base);
  });

  it("changes when the repository changes", () => {
    const files = [{ id: "a", sizeBytes: 10 }];
    expect(digestOfSources(files, "https://github.com/a/b")).not.toBe(digestOfSources(files, null));
    expect(digestOfSources(files, "https://github.com/a/b")).not.toBe(
      digestOfSources(files, "https://github.com/a/c")
    );
  });

  it("does not depend on the order files come back in", () => {
    const a = [{ id: "1", sizeBytes: 5 }, { id: "2", sizeBytes: 6 }];
    expect(digestOfSources(a, null)).toBe(digestOfSources([...a].reverse(), null));
  });
});

describe("collectBrainSources", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const options = { projectName: "Demo", repoUrl: null };

  it("collects text files as labelled documents", async () => {
    const rows: Row[] = [
      { id: "1", name: "README.md", storage_path: "p/1", size_bytes: 20 },
      { id: "2", name: "package.json", storage_path: "p/2", size_bytes: 30 },
    ];
    const supabase = supabaseWith(rows, (path) =>
      textBlob(path === "p/1" ? "# Demo" : '{"name":"demo"}')
    );

    const result = await collectBrainSources(supabase, "u1", "proj1", options);

    expect(result.input.documents).toEqual([
      { label: "README.md", text: "# Demo" },
      { label: "package.json", text: '{"name":"demo"}' },
    ]);
    expect(result.sources).toEqual([
      { kind: "file", name: "README.md" },
      { kind: "file", name: "package.json" },
    ]);
  });

  it("sends images as images, not as text", async () => {
    const rows: Row[] = [
      { id: "1", name: "shot.png", storage_path: "p/1", size_bytes: 100 },
      { id: "2", name: "notes.md", storage_path: "p/2", size_bytes: 10 },
    ];
    const supabase = supabaseWith(rows, (path) => (path === "p/1" ? pngBlob(64) : textBlob("hi")));

    const result = await collectBrainSources(supabase, "u1", "proj1", options);

    expect(result.input.documents).toHaveLength(1);
    expect(result.input.images).toHaveLength(1);
    expect(result.input.images[0].mediaType).toBe("image/png");
    expect(result.input.images[0].base64.length).toBeGreaterThan(0);
    expect(result.sources).toContainEqual({ kind: "image", name: "shot.png" });
  });

  it("derives the media type from the extension", async () => {
    const rows: Row[] = [{ id: "1", name: "hero.webp", storage_path: "p/1", size_bytes: 10 }];
    const result = await collectBrainSources(
      supabaseWith(rows, () => pngBlob(8)),
      "u1",
      "proj1",
      options
    );
    expect(result.input.images[0].mediaType).toBe("image/webp");
  });

  // Bilder sind der teuerste Teil einer Analyse, und der Grenznutzen faellt
  // schnell: der dritte Screenshot derselben App zeigt dieselbe Design-Sprache.
  it("caps how many screenshots enter one analysis", async () => {
    const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
      id: `${i}`,
      name: `shot${i}.png`,
      storage_path: `p/${i}`,
      size_bytes: 100,
    }));
    const result = await collectBrainSources(
      supabaseWith(rows, () => pngBlob(64)),
      "u1",
      "proj1",
      options
    );
    expect(result.input.images).toHaveLength(3);
    // Und behauptet nicht, die uebrigen seien eingeflossen.
    expect(result.sources.filter((s) => s.kind === "image")).toHaveLength(3);
  });

  it("skips a file it cannot download instead of failing the run", async () => {
    const rows: Row[] = [
      { id: "1", name: "a.md", storage_path: "p/1", size_bytes: 10 },
      { id: "2", name: "b.md", storage_path: "p/2", size_bytes: 10 },
    ];
    const result = await collectBrainSources(
      supabaseWith(rows, (path) => (path === "p/1" ? textBlob("da") : null)),
      "u1",
      "proj1",
      options
    );
    expect(result.input.documents).toEqual([{ label: "a.md", text: "da" }]);
  });

  it("drops an empty file rather than sending a blank document", async () => {
    const rows: Row[] = [{ id: "1", name: "leer.md", storage_path: "p/1", size_bytes: 0 }];
    const result = await collectBrainSources(
      supabaseWith(rows, () => textBlob("   ")),
      "u1",
      "proj1",
      options
    );
    expect(result.input.documents).toHaveLength(0);
  });

  it("keeps the whole text budget bounded", async () => {
    const rows: Row[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      name: `f${i}.md`,
      storage_path: `p/${i}`,
      size_bytes: 200_000,
    }));
    const result = await collectBrainSources(
      supabaseWith(rows, () => textBlob("x".repeat(50_000))),
      "u1",
      "proj1",
      options
    );

    const total = result.input.documents.reduce((sum, d) => sum + d.text.length, 0);
    expect(total).toBeLessThanOrEqual(60_000);
    // Und jede Einzeldatei bleibt unter ihrer eigenen Grenze.
    for (const doc of result.input.documents) expect(doc.text.length).toBeLessThanOrEqual(12_000);
  });

  it("puts the repository first, so it gets the budget before uploads do", async () => {
    for (const response of githubResponses(["package.json"])) {
      fetchMock.mockResolvedValueOnce(response);
    }

    const rows: Row[] = [{ id: "1", name: "notes.md", storage_path: "p/1", size_bytes: 10 }];
    const result = await collectBrainSources(
      supabaseWith(rows, () => textBlob("meine Notiz")),
      "u1",
      "proj1",
      { projectName: "Demo", repoUrl: "https://github.com/acme/app" }
    );

    expect(result.input.documents[0].label).toBe("app/package.json");
    expect(result.input.repo?.slug).toBe("acme/app");
    expect(result.sources[0]).toEqual({ kind: "repo", name: "acme/app", ref: "main" });
    expect(result.repoUrl).toBe("https://github.com/acme/app");
  });

  it("ignores a repo url that is not a github repo", async () => {
    const result = await collectBrainSources(
      supabaseWith([], () => null),
      "u1",
      "proj1",
      { projectName: "Demo", repoUrl: "https://evil.com/a/b" }
    );
    // Kein einziger Netzzugriff: die URL scheitert schon an
    // parseGithubRepoUrl, es wird gar nicht erst versucht.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.input.repo).toBeNull();
    expect(result.repoUrl).toBeNull();
  });

  // Ein fehlgeschlagener Repo-Import ist etwas anderes als eine nicht lesbare
  // Datei: das Repo war eine ausdrueckliche Nutzerangabe. Still ohne es
  // weiterzurechnen wuerde ein Ergebnis liefern, das jemand fuer "das Repo
  // wurde analysiert" haelt.
  it("lets a failed repository import surface instead of silently continuing", async () => {
    for (const response of githubResponses([], 404)) {
      fetchMock.mockResolvedValueOnce(response);
    }

    const error = await collectBrainSources(supabaseWith([], () => null), "u1", "proj1", {
      projectName: "Demo",
      repoUrl: "https://github.com/acme/nope",
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "repo_not_found" });
  });
});

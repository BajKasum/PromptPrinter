import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { BUCKETS, LIST_PAGE_SIZE, MIN_AGE_MS, run } from "../../scripts/reconcile-project-files-storage.mjs";
import { POSTGREST_PAGE_SIZE } from "@/shared/lib/storage-cleanup";

// scripts/reconcile-project-files-storage.mjs entfernt mit --delete Dateien, auf die keine Zeile mehr zeigt (#425).
// Liest es eine Liste nicht ganz, sehen lebende Dateien verwaist aus und werden gelöscht. Geprüft wird gegen eine
// Attrappe des Supabase-Clients, die list() und PostgREST nachbildet: Ordner mit id null, ohne Angabe höchstens 100
// Einträge, höchstens 1000 Zeilen je Antwort. Gegen einen echten Bucket läuft hier nichts.

const NOW = Date.parse("2026-11-25T12:00:00.000Z");
const OLD = new Date(NOW - 3 * MIN_AGE_MS).toISOString();
const FRESH = new Date(NOW - 10 * 60 * 1000).toISOString();

type Stored = { path: string; changed?: string | null };
type Row = { id: string; storage_path: string };

/** storage.from(bucket): list() zeigt eine Ebene, Ordner mit id null, sortiert, ohne limit höchstens 100 Einträge. */
function fakeBucket(objects: Stored[], options: { failList?: boolean } = {}) {
  const list = vi.fn(async (prefix: string = "", search?: { limit?: number; offset?: number }) => {
    if (options.failList) return { data: null, error: new Error("storage down") };
    const base = prefix === "" ? "" : `${prefix}/`;
    const entries = new Map<string, Record<string, unknown>>();
    for (const object of objects) {
      if (!object.path.startsWith(base)) continue;
      const [name, ...rest] = object.path.slice(base.length).split("/");
      const changed = object.changed === undefined ? OLD : object.changed;
      entries.set(
        name,
        rest.length > 0
          ? { name, id: null, created_at: null, updated_at: null, last_accessed_at: null, metadata: null }
          : { name, id: `obj-${object.path}`, created_at: changed, updated_at: changed, last_accessed_at: changed, metadata: {} }
      );
    }
    const sorted = [...entries.values()].sort((a, b) => (String(a.name) < String(b.name) ? -1 : 1));
    const offset = search?.offset ?? 0;
    return { data: sorted.slice(offset, offset + (search?.limit ?? 100)), error: null };
  });
  const remove = vi.fn(async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null }));
  return { list, remove };
}

type TableOptions = {
  /** Wie viele Zeilen PostgREST höchstens je Antwort liefert (max_rows). */
  maxRows?: number;
  /** Läuft nach jeder ausgelieferten Seite und darf die Zeilen ändern, wie ein Nutzer während des Laufs. */
  afterPage?: (rows: Row[]) => void;
  failRead?: boolean;
};

/** Eine Tabelle mit storage_path: Seiten über range(), Zählung per head, Nachfrage per in(), ohne Seiten gekappt. */
function fakeTable(paths: string[], options: TableOptions = {}) {
  const rows: Row[] = paths.map((storage_path, i) => ({ id: `row-${String(i).padStart(6, "0")}`, storage_path }));
  const maxRows = options.maxRows ?? POSTGREST_PAGE_SIZE;
  const orderedBy: string[] = [];
  const pathsOf = (list: Row[]) => list.map(({ storage_path }) => ({ storage_path }));
  const range = vi.fn(async (from: number, to: number) => {
    if (options.failRead) return { data: null, error: { message: "permission denied" } };
    const page = rows.slice(from, Math.min(to + 1, from + maxRows));
    options.afterPage?.(rows);
    return { data: pathsOf(page), error: null };
  });
  const inFilter = vi.fn(async (_column: string, values: string[]) => ({
    data: pathsOf(rows.filter((row) => values.includes(row.storage_path))),
    error: null,
  }));
  const table = {
    select: (_columns: string, select?: { count?: string; head?: boolean }) => {
      if (select?.head) return Promise.resolve({ data: null, count: rows.length, error: null });
      return {
        order: (column: string) => {
          orderedBy.push(column);
          return { range };
        },
        in: inFilter,
        // Ohne range: wie PostgREST höchstens maxRows Zeilen, ohne es zu melden.
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: pathsOf(rows.slice(0, maxRows)), error: null }).then(resolve, reject),
      };
    },
  };
  return { table, rows, range, inFilter, orderedBy };
}

function scenario(setup: {
  objects: Stored[];
  rows: string[];
  bucket?: keyof typeof BUCKETS;
  table?: TableOptions;
  failList?: boolean;
}) {
  const bucket = setup.bucket ?? "project-files";
  const storage = fakeBucket(setup.objects, { failList: setup.failList });
  const db = fakeTable(setup.rows, setup.table);
  const supabase = {
    storage: {
      from: (name: string) => {
        if (name !== bucket) throw new Error(`unerwarteter Bucket ${name}`);
        return storage;
      },
    },
    from: (name: string) => {
      if (name !== BUCKETS[bucket]) throw new Error(`unerwartete Tabelle ${name}`);
      return db.table;
    },
  };
  const out: string[] = [];
  const err: string[] = [];
  const start = (shouldDelete: boolean) =>
    run({
      supabase,
      bucket,
      shouldDelete,
      now: NOW,
      log: (line: string) => out.push(line),
      logError: (line: string) => err.push(line),
    });
  const removed = () => storage.remove.mock.calls.flatMap(([paths]) => paths);
  return { storage, db, out, err, start, removed };
}

/** n Pfade in einem Ordner, nach Namen sortierbar. */
const files = (folder: string, n: number, name = "f") =>
  Array.from({ length: n }, (_, i) => `${folder}/${name}${String(i).padStart(4, "0")}.md`);

describe("Abgleich-Skript: nur sicher verwaiste Dateien", () => {
  it("steigt in Ordner ab (list() liefert sie mit id null) und findet die Waise darin", async () => {
    const live = ["user-1/proj-a/live.md", "user-2/conv-b/live.png"];
    const s = scenario({ objects: [...live, "user-1/proj-a/orphan.md"].map((path) => ({ path })), rows: live });

    expect(await s.start(true)).toBe(0);

    expect(s.removed()).toEqual(["user-1/proj-a/orphan.md"]);
    expect(s.out[0]).toBe('3 Objekte im Bucket "project-files", 2 Zeilen in project_files.');
  });

  it("liest jede Ebene über 100 Einträge hinaus", async () => {
    // 120 Nutzerordner, im letzten ein Projekt mit 231 Dateien: die Waise steht auf beiden Ebenen hinter Seite eins.
    const users = Array.from({ length: 120 }, (_, i) => `user-${String(i).padStart(3, "0")}`);
    const live = [...users.map((user) => `${user}/proj/a.md`), ...files("user-119/proj", 230)];
    const orphan = "user-119/proj/zz-orphan.md";
    const s = scenario({ objects: [...live, orphan].map((path) => ({ path })), rows: live });

    expect(await s.start(true)).toBe(0);

    expect(s.removed()).toEqual([orphan]);
    expect(s.out[0]).toBe(`${live.length + 1} Objekte im Bucket "project-files", ${live.length} Zeilen in project_files.`);
    const sortBy = { column: "name", order: "asc" };
    expect(s.storage.list).toHaveBeenCalledWith("", { limit: LIST_PAGE_SIZE, offset: 100, sortBy });
    expect(s.storage.list).toHaveBeenCalledWith("user-119/proj", { limit: LIST_PAGE_SIZE, offset: 200, sortBy });
  });

  it("liest mehr als 1000 Zeilen, sortiert nach id, und hält deren Dateien nicht für Waisen", async () => {
    const live = files("user-1/proj", 1200);
    const s = scenario({ objects: [...live, "user-1/proj/zz-orphan.md"].map((path) => ({ path })), rows: live });

    expect(await s.start(true)).toBe(0);

    expect(s.removed()).toEqual(["user-1/proj/zz-orphan.md"]);
    expect(s.db.range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(new Set(s.db.orderedBy)).toEqual(new Set(["id"]));
  });

  it("löscht kein Objekt, das jünger als eine Stunde ist oder keinen Zeitstempel hat", async () => {
    const s = scenario({
      objects: [
        { path: "user-1/proj/old.md" },
        { path: "user-1/proj/fresh.md", changed: FRESH },
        { path: "user-1/proj/almost.md", changed: new Date(NOW - MIN_AGE_MS + 1000).toISOString() },
        { path: "user-1/proj/no-time.md", changed: null },
      ],
      rows: [],
    });

    expect(await s.start(true)).toBe(0);

    expect(s.removed()).toEqual(["user-1/proj/old.md"]);
    const listed = s.out.join("\n");
    expect(listed).toContain("user-1/proj/fresh.md");
    expect(listed).toContain("nie gelöscht");
  });

  it("bricht ab, wenn die Datenbank mehr Zeilen zählt, als gelesen wurden (Seitengrenze unter 1000)", async () => {
    const live = files("user-1/proj", 1200);
    for (const shouldDelete of [true, false]) {
      const s = scenario({
        objects: [...live, "user-1/proj/zz-orphan.md"].map((path) => ({ path })),
        rows: live,
        table: { maxRows: 500 },
      });

      expect(await s.start(shouldDelete)).toBe(2);

      expect(s.storage.remove).not.toHaveBeenCalled();
      expect(s.err.join("\n")).toMatch(/Abgebrochen, nichts gelöscht: 500 Zeilen .* zählt 1200/);
      // Auch ohne --delete keine Liste, die lebende Dateien als Waisen ausgibt.
      expect(s.out.join("\n")).not.toContain("verwaist");
    }
  });

  it("bricht ab, wenn direkt vor dem Löschen doch eine Zeile auf eine Waise zeigt (verrutschte Seiten)", async () => {
    // Nach der ersten Seite löscht jemand eine Zeile daraus: die zweite Seite beginnt eine Zeile später, die Zeile an
    // Stelle 1000 fehlt in der Liste, und die Zählung stimmt trotzdem wieder.
    const live = files("user-1/proj", 1200);
    let pages = 0;
    const s = scenario({
      objects: [...live, "user-1/proj/zz-orphan.md"].map((path) => ({ path })),
      rows: live,
      table: {
        afterPage: (rows) => {
          if (pages++ === 0) rows.splice(3, 1);
        },
      },
    });

    expect(await s.start(true)).toBe(2);

    expect(s.storage.remove).not.toHaveBeenCalled();
    expect(s.db.inFilter).toHaveBeenCalled();
    expect(s.err.join("\n")).toContain("zeigt doch eine Zeile");
  });

  it("bricht bei einem Lesefehler ab, statt mit einer halben Liste weiterzumachen", async () => {
    const objects = [{ path: "user-1/proj/orphan.md" }];
    for (const s of [scenario({ objects, rows: [], failList: true }), scenario({ objects, rows: [], table: { failRead: true } })]) {
      expect(await s.start(true)).toBe(1);
      expect(s.storage.remove).not.toHaveBeenCalled();
      expect(s.err.join("\n")).toContain("Lesen gescheitert");
    }
  });

  it("listet ohne --delete nur", async () => {
    const s = scenario({ objects: [{ path: "user-1/proj/orphan.md" }], rows: [] });

    expect(await s.start(false)).toBe(0);

    expect(s.storage.remove).not.toHaveBeenCalled();
    expect(s.db.inFilter).not.toHaveBeenCalled();
    expect(s.out.join("\n")).toContain("user-1/proj/orphan.md");
  });

  it("prüft chat-attachments gegen message_attachments", async () => {
    const s = scenario({
      bucket: "chat-attachments",
      objects: [{ path: "user-1/conv-1/a.png" }, { path: "user-1/conv-1/b.txt" }],
      rows: ["user-1/conv-1/a.png"],
    });

    expect(await s.start(true)).toBe(0);

    expect(s.removed()).toEqual(["user-1/conv-1/b.txt"]);
  });

  it("endet mit 1, wenn sich Objekte nicht löschen lassen", async () => {
    const s = scenario({ objects: [{ path: "user-1/proj/orphan.md" }], rows: [] });
    s.storage.remove.mockResolvedValue({ data: null, error: new Error("boom") } as never);

    expect(await s.start(true)).toBe(1);
    expect(s.err.join("\n")).toContain("1 Objekt(e) ließen sich nicht löschen");
  });

  it("kennt nur die zwei Buckets mit Tabelle", async () => {
    const logError = vi.fn();
    const supabase = { storage: { from: vi.fn() }, from: vi.fn() };

    expect(await run({ supabase, bucket: "avatars", log: vi.fn(), logError })).toBe(1);

    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // Vitest löst den Import von storage-cleanup.ts selbst auf; Node muss es auch ohne Vitest können, und beim Import
  // darf nichts loslaufen.
  it("lädt unter Node ohne Vitest, ohne beim Import zu starten", () => {
    const script = pathToFileURL(join(process.cwd(), "scripts/reconcile-project-files-storage.mjs")).href;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `const m = await import(${JSON.stringify(script)}); console.log(typeof m.run);`],
      { encoding: "utf8" }
    );

    expect(child.status, child.stderr).toBe(0);
    expect(child.stdout.trim()).toBe("function");
  });
});

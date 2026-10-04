import { afterEach, describe, expect, it, vi } from "vitest";
import { classify, decryptWith, encryptWith, run } from "../../scripts/rotate-byok-secret.mjs";
import { decrypt, encrypt } from "@/server/security/crypto";

// scripts/rotate-byok-secret.mjs schreibt in die Produktions-Datenbank und trägt
// eine Kopie der Verschlüsselung aus src/server/security/crypto.ts (ein
// TypeScript-Modul mit `server-only` ist kein Skript-Import). Eine Kopie, die
// vom Original abweicht, schlüsselte Zeilen in etwas um, das die App nicht mehr
// öffnet — also exakt der Schaden, den die Rotation vermeiden soll. Dieser Test
// hält beide gegeneinander fest und prüft, dass das Skript nur schreibt, was es
// darf.

const OLD = "the-old-secret-value";
const NEW = "the-new-secret-value";

const prev = {
  current: process.env.API_KEY_ENCRYPTION_SECRET,
  previous: process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS,
};
afterEach(() => {
  if (prev.current === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
  else process.env.API_KEY_ENCRYPTION_SECRET = prev.current;
  if (prev.previous === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS;
  else process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS = prev.previous;
});

describe("Verschlüsselung des Skripts ist die der App", () => {
  it("die App öffnet, was das Skript verschlüsselt hat", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = NEW;
    delete process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS;
    expect(decrypt(encryptWith(NEW, "sk-ant-api03-abc"))).toBe("sk-ant-api03-abc");
  });

  it("das Skript öffnet, was die App verschlüsselt hat", () => {
    process.env.API_KEY_ENCRYPTION_SECRET = OLD;
    delete process.env.API_KEY_ENCRYPTION_SECRET_PREVIOUS;
    expect(decryptWith(OLD, encrypt("sk-ant-api03-abc"))).toBe("sk-ant-api03-abc");
  });

  it("decryptWith gibt bei falschem Secret oder kaputtem Blob null zurück, statt zu werfen", () => {
    const blob = encryptWith(OLD, "x");
    expect(decryptWith(NEW, blob)).toBeNull();
    expect(decryptWith(OLD, "kein-base64-blob!!")).toBeNull();
    expect(decryptWith(OLD, "")).toBeNull();
  });
});

describe("classify", () => {
  it("current: das neue Secret öffnet die Zeile", () => {
    expect(classify(encryptWith(NEW, "k"), { current: NEW, previous: OLD }).state).toBe("current");
  });

  it("previous: nur das alte Secret öffnet sie, und der Klartext reist mit", () => {
    expect(classify(encryptWith(OLD, "k"), { current: NEW, previous: OLD })).toEqual({
      state: "previous",
      plaintext: "k",
    });
  });

  it("unreadable: keins von beiden öffnet sie", () => {
    expect(classify(encryptWith("third", "k"), { current: NEW, previous: OLD }).state).toBe("unreadable");
  });
});

// ─── Der Ablauf gegen eine Fake-Datenbank ──────────────────────────────────

type Row = { id: string; encrypted_key: string };

/** Ein PostgREST-förmiger Stand-in: GET liefert die Zeilen, PATCH mit Filter schreibt. */
function fakeDatabase(initial: Row[], hooks: { beforePatch?: (rows: Row[]) => void } = {}) {
  const rows = initial.map((r) => ({ ...r }));
  const calls: { method: string; url: string }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url });
    if (method === "GET") return new Response(JSON.stringify(rows), { status: 200 });
    if (method === "PATCH") {
      hooks.beforePatch?.(rows);
      const query = new URL(url).searchParams;
      const id = query.get("id")?.replace(/^eq\./, "");
      const oldBlob = query.get("encrypted_key")?.replace(/^eq\./, "");
      const row = rows.find((r) => r.id === id && r.encrypted_key === oldBlob);
      if (!row) return new Response("[]", { status: 200 });
      row.encrypted_key = JSON.parse(String(init?.body)).encrypted_key;
      return new Response(JSON.stringify([{ id: row.id }]), { status: 200 });
    }
    return new Response("nope", { status: 405 });
  });
  return { rows, calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function options(db: ReturnType<typeof fakeDatabase>, extra: Partial<Parameters<typeof run>[0]> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    opts: {
      base: "https://example.supabase.co/",
      serviceKey: "service-role-key-value",
      current: NEW,
      previous: OLD,
      fetchImpl: db.fetchImpl,
      log: (l: string) => out.push(l),
      logError: (l: string) => err.push(l),
      ...extra,
    },
  };
}

const seed = (): Row[] => [
  { id: "a", encrypted_key: encryptWith(OLD, "key-a") },
  { id: "b", encrypted_key: encryptWith(NEW, "key-b") },
  { id: "c", encrypted_key: encryptWith(OLD, "key-c") },
];

describe("run", () => {
  it("Probelauf: zählt, schreibt NICHTS und meldet Exit 1, solange Zeilen offen sind", async () => {
    const db = fakeDatabase(seed());
    const { opts, out } = options(db);
    expect(await run({ ...opts, apply: false })).toBe(1);
    expect(db.calls.every((c) => c.method === "GET")).toBe(true);
    expect(out.join("\n")).toContain("nur altes Secret:   2");
    expect(out.join("\n")).toContain("Probelauf, nichts geschrieben");
  });

  it("--apply: schlüsselt nur die alten Zeilen um, und die App öffnet sie danach mit dem neuen Secret", async () => {
    const db = fakeDatabase(seed());
    const before = db.rows.find((r) => r.id === "b")!.encrypted_key;
    expect(await run({ ...options(db).opts, apply: true })).toBe(0);

    expect(db.rows.find((r) => r.id === "b")!.encrypted_key).toBe(before); // fertige Zeile unberührt
    for (const [id, plain] of [["a", "key-a"], ["c", "key-c"]]) {
      const blob = db.rows.find((r) => r.id === id)!.encrypted_key;
      expect(decryptWith(NEW, blob)).toBe(plain);
      expect(decryptWith(OLD, blob)).toBeNull();
    }
  });

  it("ein zweiter Probelauf nach --apply meldet Exit 0 und 'Fertig'", async () => {
    const db = fakeDatabase(seed());
    await run({ ...options(db).opts, apply: true });
    const second = options(db);
    expect(await run({ ...second.opts, apply: false })).toBe(0);
    expect(second.out.join("\n")).toContain("nur altes Secret:   0");
    expect(second.out.join("\n")).toContain("Fertig");
  });

  it("überschreibt keine Zeile, die der Nutzer zwischendurch neu gespeichert hat", async () => {
    const userSaved = encryptWith(NEW, "key-typed-by-user-meanwhile");
    const db = fakeDatabase(seed(), {
      beforePatch: (rows) => {
        const a = rows.find((r) => r.id === "a")!;
        if (a.encrypted_key !== userSaved && decryptWith(OLD, a.encrypted_key) !== null) {
          a.encrypted_key = userSaved;
        }
      },
    });
    const { opts, out } = options(db);
    expect(await run({ ...opts, apply: true })).toBe(0);
    expect(db.rows.find((r) => r.id === "a")!.encrypted_key).toBe(userSaved);
    expect(out.join("\n")).toContain("Zeile a: inzwischen geändert");
  });

  it("meldet Exit 3 für Zeilen, die kein Secret öffnet, und löscht nichts", async () => {
    const lost = { id: "x", encrypted_key: encryptWith("lost-secret", "key-x") };
    const db = fakeDatabase([...seed(), lost]);
    const { opts, out } = options(db);
    expect(await run({ ...opts, apply: true })).toBe(3);
    expect(db.rows.find((r) => r.id === "x")).toEqual(lost);
    expect(db.calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(out.join("\n")).toContain("Zeilen-IDs: x");
  });

  it("gibt nie ein Secret, einen Schlüssel oder einen Chiffretext aus", async () => {
    const rows = seed();
    const db = fakeDatabase(rows);
    const { opts, out, err } = options(db);
    await run({ ...opts, apply: true });
    const everything = [...out, ...err].join("\n");
    for (const secret of [OLD, NEW, "service-role-key-value", "key-a", "key-b", "key-c"]) {
      expect(everything).not.toContain(secret);
    }
    for (const row of rows) expect(everything).not.toContain(row.encrypted_key);
  });

  it("bricht mit Exit 2 ab, wenn eine Angabe fehlt oder beide Secrets gleich sind", async () => {
    const db = fakeDatabase(seed());
    const base = options(db).opts;
    expect(await run({ ...base, previous: "" })).toBe(2);
    expect(await run({ ...base, serviceKey: "" })).toBe(2);
    expect(await run({ ...base, previous: NEW })).toBe(2);
    expect(db.calls).toEqual([]); // vor der Prüfung der Angaben kein einziger Aufruf
  });

  it("meldet Exit 2 bei einem Datenbankfehler und gibt dessen Antworttext nicht aus", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret row data here", { status: 500 })) as unknown as typeof fetch;
    const out: string[] = [];
    const err: string[] = [];
    const code = await run({
      base: "https://example.supabase.co",
      serviceKey: "k",
      current: NEW,
      previous: OLD,
      fetchImpl,
      log: (l) => out.push(l),
      logError: (l) => err.push(l),
    });
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("500");
    expect(err.join("\n")).not.toContain("secret row data here");
  });
});

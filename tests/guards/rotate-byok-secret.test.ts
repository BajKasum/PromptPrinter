import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_SECRET_LENGTH, classify, decryptWith, encryptWith, keyId, run } from "../../scripts/rotate-byok-secret.mjs";
import { decrypt, encrypt } from "@/server/security/crypto";
import { MIN_ENCRYPTION_SECRET_LENGTH } from "@/server/env";

// scripts/rotate-byok-secret.mjs schreibt in die Produktions-Datenbank und trägt eine Kopie der Verschlüsselung aus
// src/server/security/crypto.ts (ein TypeScript-Modul mit `server-only` ist kein Skript-Import). Eine Kopie, die vom
// Original abweicht, schlüsselte Zeilen in etwas um, das die App nicht mehr öffnet: exakt der Schaden, den die
// Rotation vermeiden soll. Dieser Test hält beide gegeneinander fest und prüft, dass das Skript nur schreibt, was es
// darf. Secrets entstehen zur Laufzeit, im Quelltext steht keins.

const newSecret = () => randomBytes(32).toString("base64");
const OLD = newSecret();
const NEW = newSecret();

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const BINDING = { userId: USER_A, provider: "anthropic" };
const ROW_A = { user_id: USER_A, provider: "anthropic" };

/** Das alte Format, eingefroren: so stehen Werte aus der Zeit vor `pp2.` in der Tabelle. */
function legacyBlob(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, "promptprinter-byok", 32), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

function useSecrets(current: string, previous = "") {
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET", current);
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET_PREVIOUS", previous);
}

describe("Verschlüsselung des Skripts ist die der App", () => {
  it("die App öffnet, was das Skript verschlüsselt hat", () => {
    useSecrets(NEW);
    expect(decrypt(encryptWith(NEW, "sk-ant-api03-abc", ROW_A), BINDING)).toBe("sk-ant-api03-abc");
  });

  it("das Skript öffnet, was die App verschlüsselt hat", () => {
    useSecrets(OLD);
    expect(decryptWith(OLD, encrypt("sk-ant-api03-abc", BINDING), ROW_A)).toBe("sk-ant-api03-abc");
  });

  it("beide nennen dasselbe Secret mit derselben Schlüssel-ID", () => {
    useSecrets(NEW);
    expect(encrypt("x", BINDING).split(".")[1]).toBe(keyId(NEW));
  });

  it("beide lesen das alte Format", () => {
    useSecrets(OLD);
    const blob = legacyBlob(OLD, "sk-alt");
    expect(decrypt(blob, BINDING)).toBe("sk-alt");
    expect(decryptWith(OLD, blob, ROW_A)).toBe("sk-alt");
  });

  it("beide binden an dieselbe Zeile: was das Skript für A schreibt, öffnet die App nicht für B", () => {
    useSecrets(NEW);
    const blob = encryptWith(NEW, "k", ROW_A);
    expect(() => decrypt(blob, { userId: USER_B, provider: "anthropic" })).toThrow();
    expect(() => decrypt(blob, { userId: USER_A, provider: "openai" })).toThrow();
  });

  it("beide verlangen dieselbe Mindestlänge", () => {
    expect(MIN_SECRET_LENGTH).toBe(MIN_ENCRYPTION_SECRET_LENGTH);
  });

  it("decryptWith gibt bei falschem Secret, fremder Zeile oder kaputtem Wert null zurück, statt zu werfen", () => {
    const blob = encryptWith(OLD, "x", ROW_A);
    expect(decryptWith(NEW, blob, ROW_A)).toBeNull();
    expect(decryptWith(OLD, blob, { user_id: USER_B, provider: "anthropic" })).toBeNull();
    expect(decryptWith(OLD, "kein-base64-blob!!", ROW_A)).toBeNull();
    expect(decryptWith(OLD, "", ROW_A)).toBeNull();
    expect(decryptWith(OLD, `pp2.${keyId(OLD)}`, ROW_A)).toBeNull();
  });
});

describe("classify", () => {
  const row = (encrypted_key: string) => ({ ...ROW_A, encrypted_key });

  it("current: aktuelles Format unter dem aktuellen Secret", () => {
    expect(classify(row(encryptWith(NEW, "k", ROW_A)), { current: NEW, previous: OLD }).state).toBe("current");
  });

  it("open: aktuelles Format, aber nur das alte Secret öffnet es, und der Klartext reist mit", () => {
    expect(classify(row(encryptWith(OLD, "k", ROW_A)), { current: NEW, previous: OLD })).toEqual({
      state: "open",
      plaintext: "k",
    });
  });

  it("open: altes Format unter dem aktuellen Secret, auch ohne PREVIOUS", () => {
    expect(classify(row(legacyBlob(NEW, "k")), { current: NEW, previous: "" })).toEqual({
      state: "open",
      plaintext: "k",
    });
  });

  it("open: altes Format unter dem alten Secret", () => {
    expect(classify(row(legacyBlob(OLD, "k")), { current: NEW, previous: OLD })).toEqual({
      state: "open",
      plaintext: "k",
    });
  });

  it("unreadable: keins von beiden öffnet sie", () => {
    expect(classify(row(encryptWith(newSecret(), "k", ROW_A)), { current: NEW, previous: OLD }).state).toBe("unreadable");
    expect(classify(row(legacyBlob(newSecret(), "k")), { current: NEW, previous: OLD }).state).toBe("unreadable");
  });

  it("unreadable: ein Chiffretext aus der Zeile eines anderen Kontos", () => {
    const foreign = encryptWith(NEW, "k", { user_id: USER_B, provider: "anthropic" });
    expect(classify(row(foreign), { current: NEW, previous: OLD }).state).toBe("unreadable");
  });
});

// ─── Der Ablauf gegen eine Fake-Datenbank ──────────────────────────────────

type Row = { id: string; user_id: string; provider: string; encrypted_key: string };

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

const rowOf = (id: string, user_id: string, encrypted_key: string): Row => ({
  id,
  user_id,
  provider: "anthropic",
  encrypted_key,
});

const seed = (): Row[] => [
  rowOf("a", USER_A, legacyBlob(OLD, "key-a")),
  rowOf("b", USER_B, encryptWith(NEW, "key-b", { user_id: USER_B, provider: "anthropic" })),
  rowOf("c", "33333333-3333-4333-8333-333333333333", legacyBlob(OLD, "key-c")),
];

describe("run", () => {
  it("Probelauf: zählt, schreibt NICHTS und meldet Exit 1, solange Zeilen offen sind", async () => {
    const db = fakeDatabase(seed());
    const { opts, out } = options(db);
    expect(await run({ ...opts, apply: false })).toBe(1);
    expect(db.calls.every((c) => c.method === "GET")).toBe(true);
    expect(out.join("\n")).toContain("offen:              2");
    expect(out.join("\n")).toContain("Probelauf, nichts geschrieben");
  });

  it("liest Nutzer und Anbieter mit, sonst könnte es nicht an die Zeile binden", async () => {
    const db = fakeDatabase(seed());
    await run({ ...options(db).opts, apply: false });
    expect(db.calls[0].url).toContain("select=id,user_id,provider,encrypted_key");
  });

  it("--apply: hebt die offenen Zeilen auf das neue Format, und die App öffnet sie danach für ihre Zeile", async () => {
    const db = fakeDatabase(seed());
    const before = db.rows.find((r) => r.id === "b")!.encrypted_key;
    expect(await run({ ...options(db).opts, apply: true })).toBe(0);

    expect(db.rows.find((r) => r.id === "b")!.encrypted_key).toBe(before); // fertige Zeile unberührt
    useSecrets(NEW);
    for (const [id, plain] of [["a", "key-a"], ["c", "key-c"]]) {
      const row = db.rows.find((r) => r.id === id)!;
      expect(row.encrypted_key.startsWith("pp2.")).toBe(true);
      expect(decrypt(row.encrypted_key, { userId: row.user_id, provider: row.provider })).toBe(plain);
      expect(decryptWith(OLD, row.encrypted_key, row)).toBeNull();
    }
  });

  it("reiner Formatwechsel: ohne PREVIOUS, unter demselben Secret, ohne Verlust", async () => {
    const db = fakeDatabase([rowOf("a", USER_A, legacyBlob(NEW, "key-a"))]);
    const dry = options(db, { previous: undefined });
    expect(await run({ ...dry.opts, apply: false })).toBe(1);
    expect(dry.out.join("\n")).toContain("offen:              1");

    expect(await run({ ...options(db, { previous: "" }).opts, apply: true })).toBe(0);
    useSecrets(NEW);
    const row = db.rows[0];
    expect(decrypt(row.encrypted_key, { userId: row.user_id, provider: row.provider })).toBe("key-a");
    expect(await run({ ...options(db, { previous: "" }).opts, apply: false })).toBe(0);
  });

  it("nach dem Umschlüsseln sind zwei getauschte Werte unlesbar: Exit 3, nichts wird überschrieben", async () => {
    const db = fakeDatabase(seed());
    await run({ ...options(db).opts, apply: true });
    const [a, b] = [db.rows.find((r) => r.id === "a")!, db.rows.find((r) => r.id === "b")!];
    [a.encrypted_key, b.encrypted_key] = [b.encrypted_key, a.encrypted_key];
    const swapped = { a: a.encrypted_key, b: b.encrypted_key };

    const { opts, out } = options(db);
    expect(await run({ ...opts, apply: true })).toBe(3);
    expect(out.join("\n")).toContain("von keinem lesbar:  2");
    expect(a.encrypted_key).toBe(swapped.a);
    expect(b.encrypted_key).toBe(swapped.b);
  });

  it("ein zweiter Probelauf nach --apply meldet Exit 0 und 'Fertig'", async () => {
    const db = fakeDatabase(seed());
    await run({ ...options(db).opts, apply: true });
    const second = options(db);
    expect(await run({ ...second.opts, apply: false })).toBe(0);
    expect(second.out.join("\n")).toContain("offen:              0");
    expect(second.out.join("\n")).toContain("Fertig");
  });

  it("überschreibt keine Zeile, die der Nutzer zwischendurch neu gespeichert hat", async () => {
    const userSaved = encryptWith(NEW, "key-typed-by-user-meanwhile", ROW_A);
    const db = fakeDatabase(seed(), {
      beforePatch: (rows) => {
        const a = rows.find((r) => r.id === "a")!;
        if (a.encrypted_key !== userSaved && decryptWith(OLD, a.encrypted_key, a) !== null) {
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
    const lost = rowOf("x", USER_A, legacyBlob(newSecret(), "key-x"));
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
    for (const row of [...rows, ...db.rows]) expect(everything).not.toContain(row.encrypted_key);
  });

  it("bricht mit Exit 2 ab, wenn eine Angabe fehlt, beide Secrets gleich sind oder das aktuelle zu kurz ist", async () => {
    const db = fakeDatabase(seed());
    const base = options(db).opts;
    expect(await run({ ...base, current: "" })).toBe(2);
    expect(await run({ ...base, serviceKey: "" })).toBe(2);
    expect(await run({ ...base, previous: NEW })).toBe(2);
    expect(await run({ ...base, current: "x".repeat(MIN_SECRET_LENGTH - 1) })).toBe(2);
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

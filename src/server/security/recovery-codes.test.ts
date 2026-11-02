import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Ein Double der Tabelle: Zeilen im Speicher, Filter wie PostgREST. So zählt, was wirklich gespeichert und getroffen wird.
type Row = { user_id: string; code_hash: string; used_at: string | null };
let rows: Row[] = [];
let failWith: string | null = null;

function table() {
  const filters: ((row: Row) => boolean)[] = [];
  let op: { kind: "update" | "delete" | "select"; values?: Partial<Row> } = { kind: "select" };
  const run = () => {
    if (failWith) return { data: null, count: null, error: { message: failWith } };
    const hits = rows.filter((row) => filters.every((f) => f(row)));
    if (op.kind === "update") hits.forEach((row) => Object.assign(row, op.values));
    if (op.kind === "delete") rows = rows.filter((row) => !hits.includes(row));
    return { data: hits.map(() => ({ id: "x" })), count: hits.length, error: null };
  };
  const chain: Record<string, unknown> = {
    insert: async (values: Row[]) => {
      if (failWith) return { error: { message: failWith } };
      rows.push(...values.map((v) => ({ ...v, used_at: null })));
      return { error: null };
    },
    update: (values: Partial<Row>) => {
      op = { kind: "update", values };
      return chain;
    },
    delete: () => {
      op = { kind: "delete" };
      return chain;
    },
    select: () => chain,
    eq: (column: keyof Row, value: unknown) => {
      filters.push((row) => row[column] === value);
      return chain;
    },
    is: (column: keyof Row, value: unknown) => {
      filters.push((row) => row[column] === value);
      return chain;
    },
    then: (resolve: (v: unknown) => unknown) => resolve(run()),
  };
  return chain;
}

vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => ({ from: () => table() }) }));

import {
  RECOVERY_CODE_COUNT,
  countRecoveryCodes,
  deleteRecoveryCodes,
  normalizeRecoveryCode,
  redeemRecoveryCode,
  replaceRecoveryCodes,
} from "@/server/security/recovery-codes";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  rows = [];
  failWith = null;
});

describe("replaceRecoveryCodes", () => {
  it("gibt zehn verschiedene Codes zum Abschreiben zurück und speichert nur Hashes", async () => {
    const codes = await replaceRecoveryCodes(USER);
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(RECOVERY_CODE_COUNT).toBe(10);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ2-9]{4}(-[BCDFGHJKLMNPQRSTVWXZ2-9]{4}){3}$/);

    expect(rows).toHaveLength(10);
    const stored = JSON.stringify(rows);
    for (const code of codes) {
      expect(stored).not.toContain(code);
      expect(stored).not.toContain(code.replaceAll("-", ""));
    }
    for (const row of rows) expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("bindet den Hash ans Konto: ein gleicher Code fiele bei zwei Konten nicht auf", async () => {
    const sha = (text: string) => createHash("sha256").update(text).digest("hex");
    const [code] = await replaceRecoveryCodes(USER);
    const plain = code.replaceAll("-", "");
    const stored = rows.map((row) => row.code_hash);

    expect(stored).toContain(sha(`${USER}:${plain}`));
    expect(stored).not.toContain(sha(plain));
    expect(stored).not.toContain(sha(`${OTHER}:${plain}`));
  });

  it("macht die alten Codes wertlos", async () => {
    const [old] = await replaceRecoveryCodes(USER);
    await replaceRecoveryCodes(USER);
    expect(rows).toHaveLength(10);
    expect(await redeemRecoveryCode(USER, old)).toBe(false);
  });

  it("wirft bei einem Datenbankfehler", async () => {
    failWith = "db down";
    await expect(replaceRecoveryCodes(USER)).rejects.toThrow("mfa_recovery_codes");
  });
});

describe("redeemRecoveryCode", () => {
  it("löst einen Code genau einmal ein", async () => {
    const [code] = await replaceRecoveryCodes(USER);
    expect(await redeemRecoveryCode(USER, code)).toBe(true);
    expect(await redeemRecoveryCode(USER, code)).toBe(false);
    expect(await countRecoveryCodes(USER)).toBe(9);
  });

  it("nimmt den Code auch klein und ohne Trennzeichen", async () => {
    const [code] = await replaceRecoveryCodes(USER);
    expect(await redeemRecoveryCode(USER, ` ${code.replaceAll("-", "").toLowerCase()} `)).toBe(true);
  });

  it("der Code eines anderen Kontos zählt nicht", async () => {
    const [code] = await replaceRecoveryCodes(OTHER);
    expect(await redeemRecoveryCode(USER, code)).toBe(false);
    expect(await countRecoveryCodes(OTHER)).toBe(10);
  });

  it.each(["", "zu-kurz", "BCDF-GHJK-LMNP-QRS", "AAAA-AAAA-AAAA-AAAA", "BCDF-GHJK-LMNP-QRST-VWXZ"])(
    "was kein Code sein kann, fragt die Datenbank gar nicht: %j",
    async (raw) => {
      failWith = "darf nicht gefragt werden";
      expect(await redeemRecoveryCode(USER, raw)).toBe(false);
    }
  );

  it("wirft bei einem Datenbankfehler, ein Ausfall ist kein falscher Code", async () => {
    const [code] = await replaceRecoveryCodes(USER);
    failWith = "db down";
    await expect(redeemRecoveryCode(USER, code)).rejects.toThrow("mfa_recovery_codes redeem");
  });
});

describe("normalizeRecoveryCode", () => {
  it("entfernt Leerzeichen und Striche, kennt nur das Alphabet der Codes", () => {
    expect(normalizeRecoveryCode("bcdf ghjk-lmnp qrst")).toBe("BCDFGHJKLMNPQRST");
    expect(normalizeRecoveryCode("BCDF-GHJK-LMNP-QRS0")).toBeNull();
  });
});

describe("countRecoveryCodes und deleteRecoveryCodes", () => {
  it("zählt offene Codes und löscht nur die dieses Kontos", async () => {
    await replaceRecoveryCodes(USER);
    await replaceRecoveryCodes(OTHER);
    await deleteRecoveryCodes(USER);
    expect(await countRecoveryCodes(USER)).toBe(0);
    expect(await countRecoveryCodes(OTHER)).toBe(10);
  });
});

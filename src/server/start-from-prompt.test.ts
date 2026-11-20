import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadStartPrompt } from "./start-from-prompt";
import { DatabaseReadError } from "@/server/supabase/query";

// Ein Stub des Sitzungs-Clients: jede Abfrage schreibt ihre Aufrufe mit, `result` entscheidet die Antwort.
let calls: [string, ...unknown[]][] = [];
let result: { data: unknown; error: unknown } = { data: null, error: null };

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) {
    c[m] = (...a: unknown[]) => (calls.push([m, ...a]), c);
  }
  c.maybeSingle = async () => result;
  return c;
}
const supabase = { from: (table: string) => (calls.push(["from", table]), chain()) } as unknown as Parameters<
  typeof loadStartPrompt
>[0];

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";

describe("loadStartPrompt", () => {
  beforeEach(() => {
    calls = [];
    result = { data: null, error: null };
  });

  it("liest nur Zeilen des eigenen Kontos: die ID UND user_id, zusätzlich zu RLS", async () => {
    result = { data: { outputs: { prompt: "Schreib eine Einladung", title: "Einladung" } }, error: null };
    await expect(loadStartPrompt(supabase, "user-1", ID)).resolves.toBe("Schreib eine Einladung");
    expect(calls).toEqual([
      ["from", "saved_prompts"],
      ["select", "outputs"],
      ["eq", "id", ID],
      ["eq", "user_id", "user-1"],
    ]);
  });

  it("gibt still null, wenn es die Zeile für dieses Konto nicht gibt (fremd oder gelöscht)", async () => {
    result = { data: null, error: null };
    await expect(loadStartPrompt(supabase, "user-1", ID)).resolves.toBeNull();
  });

  it.each([undefined, "", "abc", "not-a-uuid", `${ID} `, ["a", "b"], [ID]])(
    "fragt bei %j gar nicht erst die Datenbank",
    async (from) => {
      await expect(loadStartPrompt(supabase, "user-1", from)).resolves.toBeNull();
      expect(calls).toEqual([]);
    }
  );

  it("gibt null für eine Zeile ohne Prompttext", async () => {
    result = { data: { outputs: { prompt: "   ", title: "Leer" } }, error: null };
    await expect(loadStartPrompt(supabase, "user-1", ID)).resolves.toBeNull();
    result = { data: { outputs: null }, error: null };
    await expect(loadStartPrompt(supabase, "user-1", ID)).resolves.toBeNull();
  });

  it("liest einen Datenbankfehler nicht als 'gibt es nicht'", async () => {
    result = { data: null, error: { message: "timeout" } };
    await expect(loadStartPrompt(supabase, "user-1", ID)).rejects.toBeInstanceOf(DatabaseReadError);
  });
});

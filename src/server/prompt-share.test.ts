import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Ein Stub der Service-Role: jede Abfrage schreibt ihre Aufrufe mit, `result` entscheidet die Antwort.
let calls: [string, ...unknown[]][] = [];
let result: { data: unknown; error: unknown } = { data: null, error: null };
let insertError: unknown = null;

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "delete"]) {
    c[m] = (...a: unknown[]) => (calls.push([m, ...a]), c);
  }
  c.maybeSingle = async () => result;
  c.then = (resolve: (v: unknown) => unknown) => resolve(result);
  c.insert = async (row: unknown) => (calls.push(["insert", row]), { error: insertError });
  return c;
}
const from = vi.fn((table: string) => (calls.push(["from", table]), chain()));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

import { createShare, isShareToken, loadSharedPrompt, newShareToken, revokeShare } from "./prompt-share";

const TOKEN = "abcdefghijABCDEFGHIJ0123456789_-";

describe("prompt-share", () => {
  beforeEach(() => {
    calls = [];
    result = { data: null, error: null };
    insertError = null;
    from.mockClear();
  });

  it("macht Tokens aus 24 Zufallsbytes: 32 Zeichen base64url, jedes anders", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(isShareToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("fragt die Datenbank gar nicht erst, wenn etwas nicht wie ein Token aussieht", async () => {
    for (const bad of ["", "kurz", `${TOKEN}x`, "abcdefghijABCDEFGHIJ0123456789/!", "' or 1=1 --"]) {
      expect(await loadSharedPrompt(bad)).toBeNull();
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("liefert nur Titel, Text und Zeitpunkt, nichts über die Person", async () => {
    result = {
      data: { created_at: "2026-11-08T10:00:00Z", saved_prompts: { outputs: { prompt: "Schreibe …", title: " Einladung " } } },
      error: null,
    };
    expect(await loadSharedPrompt(TOKEN)).toEqual({ title: "Einladung", content: "Schreibe …", sharedAt: "2026-11-08T10:00:00Z" });
    expect(calls).toContainEqual(["select", "created_at, saved_prompts(outputs)"]);
    expect(calls).toContainEqual(["eq", "token", TOKEN]);
  });

  it("gibt null für widerrufene Tokens und leere Prompts", async () => {
    expect(await loadSharedPrompt(TOKEN)).toBeNull();
    result = { data: { created_at: "x", saved_prompts: { outputs: { prompt: "   " } } }, error: null };
    expect(await loadSharedPrompt(TOKEN)).toBeNull();
  });

  it("legt eine Freigabe nur einmal an und grenzt jede Abfrage auf das Konto ein", async () => {
    result = { data: null, error: null };
    const first = await createShare("u1", "p1");
    expect(first.created).toBe(true);
    expect(calls).toContainEqual(["insert", { token: first.token, prompt_id: "p1", user_id: "u1" }]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);

    calls = [];
    result = { data: { token: TOKEN }, error: null };
    expect(await createShare("u1", "p1")).toEqual({ token: TOKEN, created: false });
    expect(calls.some(([m]) => m === "insert")).toBe(false);
  });

  it("nimmt bei zwei gleichzeitigen Klicks das Token des ersten", async () => {
    let reads = 0;
    result = { data: null, error: null };
    insertError = { code: "23505" };
    const original = result;
    from.mockImplementation((table: string) => {
      calls.push(["from", table]);
      const c = chain();
      c.maybeSingle = async () => (reads++ === 0 ? original : { data: { token: TOKEN }, error: null });
      return c;
    });
    expect(await createShare("u1", "p1")).toEqual({ token: TOKEN, created: false });
    from.mockImplementation((table: string) => (calls.push(["from", table]), chain()));
  });

  it("widerruft nur die eigene Freigabe und sagt, ob es eine gab", async () => {
    result = { data: [{ token: TOKEN }], error: null };
    expect(await revokeShare("u1", "p1")).toBe(true);
    expect(calls).toContainEqual(["eq", "prompt_id", "p1"]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    result = { data: [], error: null };
    expect(await revokeShare("u1", "p1")).toBe(false);
  });
});

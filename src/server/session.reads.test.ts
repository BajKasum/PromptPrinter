import { beforeEach, describe, expect, it, vi } from "vitest";
import { tablesClient, type TablesClientOptions } from "@tests/support/supabase-tables";

// Die Lesewege von session.ts: ohne Sitzung wird nichts gelesen, ein Lesefehler wirft (statt "kein Profil", also
// "kein Admin", oder "kein Key" zu bedeuten), und der Key-Hinweis hängt an Plan, Key und Gratis-Rahmen. Der
// Einzelbetrieb steht in session.test.ts.
let user: { id: string } | null = { id: "user-1" };
let client = tablesClient();
const createClient = vi.fn(async () => ({
  ...client,
  auth: { getUser: async () => ({ data: { user } }) },
}));
const freePromptsLeft = vi.fn();

vi.mock("@/server/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("@/server/free-trial", () => ({ freePromptsLeft: (...args: unknown[]) => freePromptsLeft(...args) }));
vi.mock("@/server/llm", () => ({ selfHostedEndpointActive: () => false }));

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  plan: "free",
  is_admin: false,
  display_name: "Anna",
  settings: null,
  ...overrides,
});

function withTables(options: TablesClientOptions) {
  client = tablesClient(options);
}

const tablesRead = () => client.reads.map((read) => read.table);

beforeEach(() => {
  vi.resetModules();
  user = { id: "user-1" };
  createClient.mockClear();
  freePromptsLeft.mockReset();
  freePromptsLeft.mockResolvedValue(0);
  withTables({ tables: { profiles: [profileRow(), profileRow({ id: "user-2", is_admin: true })], user_api_keys: [] } });
});

const load = () => import("@/server/session");

describe("getSessionProfile", () => {
  it("liest die Zeile des angemeldeten Kontos, mit dessen Kennung eingegrenzt", async () => {
    const { getSessionProfile } = await load();
    await expect(getSessionProfile()).resolves.toMatchObject({ display_name: "Anna", is_admin: false });
    expect(client.reads).toHaveLength(1);
    expect(client.reads[0].filters).toEqual([["eq", "id", "user-1"]]);
  });

  it("ist ohne Sitzung null und liest nichts", async () => {
    user = null;
    const { getSessionProfile } = await load();
    await expect(getSessionProfile()).resolves.toBeNull();
    expect(tablesRead()).toEqual([]);
  });

  it("ist ohne Zeile null", async () => {
    withTables({ tables: { profiles: [] } });
    const { getSessionProfile } = await load();
    await expect(getSessionProfile()).resolves.toBeNull();
  });

  it("wirft bei einem Lesefehler, statt 'kein Profil' zu melden", async () => {
    withTables({ errors: { profiles: "timeout" } });
    const { getSessionProfile } = await load();
    await expect(getSessionProfile()).rejects.toThrow("database read failed: profiles");
  });
});

describe("Key-Hinweis im Chat auf dem Server-Key", () => {
  const state = async () => {
    const { getNeedsOwnKey, getFreePromptsLeft } = await load();
    return { needsKey: await getNeedsOwnKey(), left: await getFreePromptsLeft() };
  };

  it("ist ohne Sitzung kein Hinweis und liest nichts", async () => {
    user = null;
    await expect(state()).resolves.toEqual({ needsKey: false, left: null });
    expect(tablesRead()).toEqual([]);
    expect(freePromptsLeft).not.toHaveBeenCalled();
  });

  it("ein Admin läuft ohne Grenze: keine Key-Abfrage, kein Gratis-Zähler", async () => {
    withTables({ tables: { profiles: [profileRow({ is_admin: true })] } });
    await expect(state()).resolves.toEqual({ needsKey: false, left: null });
    expect(tablesRead()).not.toContain("user_api_keys");
    expect(freePromptsLeft).not.toHaveBeenCalled();
  });

  it("mit eigenem Key kein Hinweis, auch bei aufgebrauchtem Rahmen", async () => {
    withTables({ tables: { profiles: [profileRow()], user_api_keys: [{ user_id: "user-1", provider: "openai" }] } });
    await expect(state()).resolves.toEqual({ needsKey: false, left: null });
    expect(freePromptsLeft).not.toHaveBeenCalled();
  });

  it("zählt nur den eigenen Key, auch wenn RLS fremde Zeilen durchliesse", async () => {
    withTables({ tables: { profiles: [profileRow()], user_api_keys: [{ user_id: "user-2", provider: "openai" }] } });
    await expect(state()).resolves.toEqual({ needsKey: true, left: null });
    const read = client.reads.find((r) => r.table === "user_api_keys");
    expect(read?.filters).toEqual([["eq", "user_id", "user-1"]]);
    expect(read?.columns).toBe("provider");
    expect(freePromptsLeft).toHaveBeenCalledWith("user-1");
  });

  it.each([
    [3, { needsKey: false, left: 3 }],
    [1, { needsKey: false, left: 1 }],
    [0, { needsKey: true, left: null }],
    // null heisst "nicht zählbar" (kein Redis): dann verlangt die Seite den Key, statt einen Rahmen zu versprechen.
    [null, { needsKey: true, left: null }],
  ])("ohne Key bei %j Gratis-Prompts: %o", async (left, expected) => {
    freePromptsLeft.mockResolvedValue(left);
    await expect(state()).resolves.toEqual(expected);
  });

  it("wirft bei einem Lesefehler der Keys, statt 'kein Key' zu melden", async () => {
    withTables({ tables: { profiles: [profileRow()] }, errors: { user_api_keys: "timeout" } });
    const { getNeedsOwnKey } = await load();
    await expect(getNeedsOwnKey()).rejects.toThrow("database read failed: user_api_keys");
    expect(freePromptsLeft).not.toHaveBeenCalled();
  });
});

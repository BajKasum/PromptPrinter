import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadVersionTarget } from "./prompt-version-target";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CHAT = "33333333-3333-4333-8333-333333333333";
const SOURCE = "44444444-4444-4444-8444-444444444444";
const LATEST = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;

/**
 * Eine Datenbank aus Zeilen je Tabelle, die nur die Filter dieses Moduls kennt (eq, order, limit, maybeSingle). Sie
 * filtert wirklich: fehlt im Code ein `.eq("user_id", …)`, kommen fremde Zeilen durch, und die Tests schlagen an.
 */
function fakeClient(tables: Record<string, Row[]>) {
  const filtersSeen: string[] = [];
  const client = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const chain = {
        select: () => chain,
        eq(column: string, value: unknown) {
          filtersSeen.push(`${table}.${column}`);
          rows = rows.filter((r) => r[column] === value);
          return chain;
        },
        order(column: string, { ascending }: { ascending: boolean }) {
          rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
          return chain;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return chain;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      };
      return chain;
    },
  };
  return { client: client as never, filtersSeen };
}

const prompt = (id: string, user: string, extra: Row = {}): Row => ({
  id,
  user_id: user,
  outputs: { prompt: `Text ${id.slice(0, 4)}`, title: `Titel ${id.slice(0, 4)}` },
  created_at: "2026-11-20T10:00:00Z",
  conversation_id: null,
  ...extra,
});

describe("loadVersionTarget", () => {
  it("nimmt den zuletzt aus diesem Chat gespeicherten Prompt", async () => {
    const { client } = fakeClient({
      saved_prompts: [
        prompt(SOURCE, USER, { conversation_id: CHAT, created_at: "2026-11-20T09:00:00Z" }),
        prompt(LATEST, USER, { conversation_id: CHAT, created_at: "2026-11-21T09:00:00Z" }),
      ],
      conversations: [{ id: CHAT, user_id: USER, source_prompt_id: null }],
    });
    expect(await loadVersionTarget(client, USER, { conversationId: CHAT })).toEqual({
      id: LATEST,
      title: "Titel 5555",
      prompt: "Text 5555",
    });
  });

  it("nimmt sonst den Ursprung des Chats aus \"Als Ausgangspunkt nutzen\"", async () => {
    const { client } = fakeClient({
      saved_prompts: [prompt(SOURCE, USER)],
      conversations: [{ id: CHAT, user_id: USER, source_prompt_id: SOURCE }],
    });
    expect((await loadVersionTarget(client, USER, { conversationId: CHAT }))?.id).toBe(SOURCE);
  });

  it("nimmt für einen neuen Chat den Prompt aus ?from=, nur wenn er dem Konto gehört", async () => {
    const { client } = fakeClient({ saved_prompts: [prompt(SOURCE, USER), prompt(LATEST, OTHER)] });
    expect((await loadVersionTarget(client, USER, { from: SOURCE }))?.id).toBe(SOURCE);
    expect(await loadVersionTarget(client, USER, { from: LATEST })).toBeNull();
    expect(await loadVersionTarget(client, USER, { from: "kein-uuid" })).toBeNull();
    expect(await loadVersionTarget(client, USER, {})).toBeNull();
  });

  it("liest nur Zeilen des Kontos, auch wenn RLS fehlte", async () => {
    const { client, filtersSeen } = fakeClient({
      saved_prompts: [prompt(LATEST, OTHER, { conversation_id: CHAT }), prompt(SOURCE, OTHER)],
      conversations: [{ id: CHAT, user_id: OTHER, source_prompt_id: SOURCE }],
    });
    expect(await loadVersionTarget(client, USER, { conversationId: CHAT })).toBeNull();
    expect(filtersSeen).toContain("saved_prompts.user_id");
    expect(filtersSeen).toContain("conversations.user_id");
  });

  it("bietet einen Prompt ohne Text nicht an und nimmt einen leeren Titel hin", async () => {
    const { client } = fakeClient({
      saved_prompts: [
        prompt(SOURCE, USER, { outputs: { prompt: "  " } }),
        prompt(LATEST, USER, { outputs: { prompt: "Ohne Titel" } }),
      ],
    });
    expect(await loadVersionTarget(client, USER, { from: SOURCE })).toBeNull();
    expect(await loadVersionTarget(client, USER, { from: LATEST })).toEqual({ id: LATEST, title: "", prompt: "Ohne Titel" });
  });
});

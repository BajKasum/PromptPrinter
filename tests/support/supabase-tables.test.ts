import { describe, expect, it } from "vitest";
import { tablesClient } from "./supabase-tables";

// Die Seitentests verlassen sich darauf, dass der Nachbau wie PostgREST nur die genannten Spalten liefert: sonst
// bliebe eine im `select` vergessene Spalte dort unbemerkt.
const row = { id: "c-1", title: "Chat", user_id: "user-1", messages: [{ count: 2 }] };
const client = () => tablesClient({ tables: { conversations: [row] } });

describe("tablesClient: Spalten", () => {
  it.each([
    ["id, title", { id: "c-1", title: "Chat" }],
    ["id, messages(count)", { id: "c-1", messages: [{ count: 2 }] }],
    ["id, messages!inner(count, role), title", { id: "c-1", messages: [{ count: 2 }], title: "Chat" }],
    // `title` und `user_id` in der Klammer sind Spalten der verschachtelten Tabelle, nicht dieser.
    ["id, messages(count, title, user_id, role)", { id: "c-1", messages: [{ count: 2 }] }],
    ["*", row],
    ["id, fehlt", { id: "c-1" }],
  ])("select(%j) liefert nur diese", async (columns, expected) => {
    const { data } = await client().from("conversations").select(columns);
    expect(data).toStrictEqual([expected]);
  });

  it("kappt auch bei maybeSingle, und filtert nach einer Spalte, die nicht gewählt ist", async () => {
    const result = await client().from("conversations").select("title").eq("user_id", "user-1").maybeSingle();
    expect(result.data).toStrictEqual({ title: "Chat" });
  });
});

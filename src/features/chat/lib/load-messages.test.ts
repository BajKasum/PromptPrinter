import { describe, expect, it, vi } from "vitest";
import { loadConversationMessages } from "@/features/chat/lib/load-messages";
import { MESSAGE_LOAD_LIMIT } from "@/shared/lib/chat-limits";

// Der Verlauf, den die beiden Chat-Seiten laden: Nachrichten, an den
// Nutzer-Nachrichten ihre Anhänge, an den Bildern eine signierte Adresse.

type Result = { data: unknown; error: unknown };

function stub(opts: {
  embedded: Result;
  plain?: Result;
  signed?: Record<string, string>;
  signFails?: boolean;
}) {
  const selects: string[] = [];
  const filters: [string, unknown][] = [];
  const orders: unknown[][] = [];
  const limits: number[] = [];
  const createSignedUrls = vi.fn(async (paths: string[]) => {
    if (opts.signFails) throw new Error("storage down");
    return {
      data: paths.map((path) => ({
        path,
        signedUrl: opts.signed?.[path] ?? `https://signed.test/${path}`,
        error: null,
      })),
    };
  });

  const client = {
    from: () => {
      let result: Result = opts.embedded;
      const chain: Record<string, unknown> = {
        select: (columns: string) => {
          selects.push(columns);
          // Die zweite Abfrage (ohne Anhänge) ist der Rückfall.
          result = columns.includes("message_attachments") ? opts.embedded : (opts.plain ?? opts.embedded);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        },
        order: (...args: unknown[]) => {
          orders.push(args);
          return chain;
        },
        limit: (n: number) => {
          limits.push(n);
          return chain;
        },
        then: (resolve: (v: Result) => unknown) => resolve(result),
      };
      return chain;
    },
    storage: { from: () => ({ createSignedUrls }) },
  };
  return { client: client as never, selects, filters, orders, limits, createSignedUrls };
}

const imageRow = {
  id: "a1",
  name: "entwurf.png",
  kind: "image",
  media_type: "image/png",
  size_bytes: 5000,
  storage_path: "u1/c1/a1.png",
};
const textRow = {
  id: "a2",
  name: "notes.md",
  kind: "text",
  media_type: "text/plain",
  size_bytes: 300,
  storage_path: "u1/c1/a2.txt",
};

// Neueste zuerst, wie die Datenbank sie liefert.
const NEWEST_FIRST = [
  { id: "m3", role: "assistant", content: "Gerne.", message_attachments: [] },
  { id: "m2", role: "user", content: "Mit Anhängen", message_attachments: [imageRow, textRow] },
  { id: "m1", role: "user", content: "Nur Text", message_attachments: [] },
];

describe("loadConversationMessages", () => {
  it("returns the messages oldest first, as the chat shows them", async () => {
    const { client } = stub({ embedded: { data: NEWEST_FIRST, error: null } });
    const messages = await loadConversationMessages(client, "u1", "c1");
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("carries the attachments on the message that owns them, and only there", async () => {
    const { client } = stub({ embedded: { data: NEWEST_FIRST, error: null } });

    const [first, second, third] = await loadConversationMessages(client, "u1", "c1");

    expect(first).not.toHaveProperty("attachments");
    expect(third).not.toHaveProperty("attachments");
    expect(second.attachments?.map((a) => a.name)).toEqual(["entwurf.png", "notes.md"]);
  });

  it("gives an image a signed preview address, and a text file none", async () => {
    const { client, createSignedUrls } = stub({ embedded: { data: NEWEST_FIRST, error: null } });

    const [, second] = await loadConversationMessages(client, "u1", "c1");

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["u1/c1/a1.png"]);
    expect(second.attachments?.[0]).toMatchObject({
      id: "a1",
      kind: "image",
      url: "https://signed.test/u1/c1/a1.png",
    });
    expect(second.attachments?.[1]).not.toHaveProperty("url");
  });

  it("never exposes the storage path to the page", async () => {
    const { client } = stub({ embedded: { data: NEWEST_FIRST, error: null } });
    const messages = await loadConversationMessages(client, "u1", "c1");
    expect(JSON.stringify(messages)).not.toContain("storage_path");
    expect(JSON.stringify(messages)).not.toContain("storagePath");
  });

  it("still shows the attachment, as a name, when signing fails", async () => {
    const { client } = stub({ embedded: { data: NEWEST_FIRST, error: null }, signFails: true });

    const [, second] = await loadConversationMessages(client, "u1", "c1");

    expect(second.attachments?.[0]).toMatchObject({ name: "entwurf.png" });
    expect(second.attachments?.[0]).not.toHaveProperty("url");
  });

  it("makes no signing call for a chat without images", async () => {
    const { client, createSignedUrls } = stub({
      embedded: { data: [{ id: "m1", role: "user", content: "Hi", message_attachments: [textRow] }], error: null },
    });
    await loadConversationMessages(client, "u1", "c1");
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("scopes the read to the owner and the conversation, newest first and bounded", async () => {
    const { client, filters, orders, limits } = stub({ embedded: { data: [], error: null } });

    await loadConversationMessages(client, "u1", "c1");

    expect(filters).toContainEqual(["conversation_id", "c1"]);
    expect(filters).toContainEqual(["user_id", "u1"]);
    expect(orders[0]).toEqual(["created_at", { ascending: false }]);
    expect(limits).toEqual([MESSAGE_LOAD_LIMIT]);
  });

  it("reads the attachments in the order they were added", async () => {
    const { client, orders } = stub({ embedded: { data: [], error: null } });
    await loadConversationMessages(client, "u1", "c1");
    expect(orders).toContainEqual([
      "created_at",
      { referencedTable: "message_attachments", ascending: true },
    ]);
  });

  // Vor Migration 0045 gibt es die Tabelle nicht, und mit ihr scheitert schon
  // der Embed. Der Chat muss trotzdem aufgehen.
  it("falls back to plain messages when the attachment query fails", async () => {
    const { client, selects } = stub({
      embedded: { data: null, error: new Error('relation "message_attachments" does not exist') },
      plain: { data: [{ id: "m1", role: "user", content: "Hallo" }], error: null },
    });

    const messages = await loadConversationMessages(client, "u1", "c1");

    expect(messages).toEqual([{ id: "m1", role: "user", content: "Hallo" }]);
    expect(selects).toHaveLength(2);
    expect(selects[1]).toBe("id, role, content");
  });

  it("returns an empty chat when there is nothing to read", async () => {
    const { client } = stub({ embedded: { data: [], error: null } });
    expect(await loadConversationMessages(client, "u1", "c1")).toEqual([]);
  });
});

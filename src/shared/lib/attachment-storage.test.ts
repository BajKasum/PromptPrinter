import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATTACHMENT_BUCKET,
  attachmentPathsOfConversation,
  attachmentPathsOfProject,
  attachmentPathsOfUser,
  removeAttachmentObjects,
} from "@/shared/lib/attachment-storage";

// Das Einsammeln der Pfade ist der heikle Teil: es muss vollständig sein
// (sonst bleiben Objekte als Waisen im Bucket) und darf nie die Aktion des
// Nutzers aufhalten (ein Chat soll sich löschen lassen, auch wenn sich seine
// Anhänge nicht auflisten lassen).

type Page = { data: { storage_path: string }[] | null; error: unknown };

/** Ein Client, dessen Query-Kette ihre Aufrufe aufzeichnet und Seiten der Reihe nach liefert. */
function clientWithPages(pages: (Page | Error)[]) {
  const calls: { table: string; select: string; eq: [string, unknown][]; range: [number, number][] } = {
    table: "",
    select: "",
    eq: [],
    range: [],
  };
  let next = 0;
  const chain: Record<string, unknown> = {};
  chain.select = (columns: string) => {
    calls.select = columns;
    return chain;
  };
  chain.eq = (column: string, value: unknown) => {
    calls.eq.push([column, value]);
    return chain;
  };
  chain.range = (from: number, to: number) => {
    calls.range.push([from, to]);
    const page = pages[Math.min(next++, pages.length - 1)];
    return page instanceof Error ? Promise.reject(page) : Promise.resolve(page);
  };
  const remove = vi.fn(async (_paths: string[]) => ({ error: null as unknown }));
  const fromStorage = vi.fn(() => ({ remove }));
  const client = {
    from: (table: string) => {
      calls.table = table;
      return chain;
    },
    storage: { from: fromStorage },
  } as unknown as SupabaseClient;
  return { client, calls, remove, fromStorage };
}

const rows = (n: number, prefix = "p") =>
  Array.from({ length: n }, (_, i) => ({ storage_path: `${prefix}${i}` }));

describe("attachmentPathsOfConversation", () => {
  it("asks for this chat's attachments only, scoped to the owner too", async () => {
    const { client, calls } = clientWithPages([{ data: rows(2), error: null }]);

    const paths = await attachmentPathsOfConversation(client, "u1", "c1");

    expect(paths).toEqual(["p0", "p1"]);
    expect(calls.table).toBe("message_attachments");
    expect(calls.select).toBe("storage_path");
    expect(calls.eq).toContainEqual(["user_id", "u1"]);
    expect(calls.eq).toContainEqual(["conversation_id", "c1"]);
  });

  // PostgREST kappt eine Antwort bei 1000 Zeilen. Wer nach der ersten Seite
  // aufhört, lässt den Rest als Waisen im Bucket zurück.
  it("reads on past the first page until it gets a short one", async () => {
    const { client, calls } = clientWithPages([
      { data: rows(1000, "a"), error: null },
      { data: rows(1000, "b"), error: null },
      { data: rows(7, "c"), error: null },
    ]);

    const paths = await attachmentPathsOfConversation(client, "u1", "c1");

    expect(paths).toHaveLength(2007);
    expect(calls.range).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops after exactly one page when it is a short one", async () => {
    const { client, calls } = clientWithPages([{ data: rows(999), error: null }]);
    await attachmentPathsOfConversation(client, "u1", "c1");
    expect(calls.range).toHaveLength(1);
  });

  it("returns an empty list for an empty chat", async () => {
    const { client } = clientWithPages([{ data: [], error: null }]);
    expect(await attachmentPathsOfConversation(client, "u1", "c1")).toEqual([]);
  });

  // Vor Migration 0045 gibt es die Tabelle nicht. Ein Chat muss sich trotzdem löschen lassen.
  it("returns what it has instead of throwing when the lookup fails", async () => {
    const { client } = clientWithPages([{ data: null, error: new Error("relation does not exist") }]);
    expect(await attachmentPathsOfConversation(client, "u1", "c1")).toEqual([]);
  });

  it("keeps the pages it already read when a later page fails", async () => {
    const { client } = clientWithPages([
      { data: rows(1000, "a"), error: null },
      { data: null, error: new Error("timeout") },
    ]);
    expect(await attachmentPathsOfConversation(client, "u1", "c1")).toHaveLength(1000);
  });

  it("does not throw when the query itself blows up", async () => {
    const { client } = clientWithPages([new Error("network")]);
    expect(await attachmentPathsOfConversation(client, "u1", "c1")).toEqual([]);
  });
});

describe("attachmentPathsOfProject", () => {
  it("joins through the conversations and filters on the project", async () => {
    const { client, calls } = clientWithPages([{ data: rows(3), error: null }]);

    const paths = await attachmentPathsOfProject(client, "u1", "proj-1");

    expect(paths).toHaveLength(3);
    expect(calls.select).toContain("conversations!inner(project_id)");
    expect(calls.eq).toContainEqual(["user_id", "u1"]);
    expect(calls.eq).toContainEqual(["conversations.project_id", "proj-1"]);
  });
});

describe("attachmentPathsOfUser", () => {
  it("covers every attachment of the account", async () => {
    const { client, calls } = clientWithPages([{ data: rows(2), error: null }]);

    expect(await attachmentPathsOfUser(client, "u1")).toEqual(["p0", "p1"]);
    expect(calls.eq).toEqual([["user_id", "u1"]]);
  });
});

describe("removeAttachmentObjects", () => {
  it("removes from the chat-attachments bucket", async () => {
    const { client, remove, fromStorage } = clientWithPages([]);

    const result = await removeAttachmentObjects(client, ["a", "b"]);

    expect(fromStorage).toHaveBeenCalledWith(ATTACHMENT_BUCKET);
    expect(ATTACHMENT_BUCKET).toBe("chat-attachments");
    expect(remove).toHaveBeenCalledWith(["a", "b"]);
    expect(result).toEqual({ removed: 2, failed: 0 });
  });

  it("makes no call at all for nothing to remove", async () => {
    const { client, fromStorage } = clientWithPages([]);
    expect(await removeAttachmentObjects(client, [])).toEqual({ removed: 0, failed: 0 });
    expect(fromStorage).not.toHaveBeenCalled();
  });

  it("works in batches, so one huge request cannot sink the rest", async () => {
    const { client, remove } = clientWithPages([]);
    const many = Array.from({ length: 250 }, (_, i) => `p${i}`);

    await removeAttachmentObjects(client, many);

    expect(remove.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
  });

  it("counts a failed batch instead of throwing, and carries on with the others", async () => {
    const { client, remove } = clientWithPages([]);
    remove.mockResolvedValueOnce({ error: new Error("storage down") });
    const many = Array.from({ length: 150 }, (_, i) => `p${i}`);

    const result = await removeAttachmentObjects(client, many);

    expect(result).toEqual({ removed: 50, failed: 100 });
  });
});

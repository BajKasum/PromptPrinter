import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import {
  MAX_ATTACHMENT_STORAGE_PER_USER,
  MAX_ATTACHMENT_IMAGE_BYTES,
} from "@/shared/lib/chat-limits";

// Anhänge an Chat-Nachrichten (2026-10-02), von der Anfrage bis zum Modell.
//
// Eigene Datei neben route.test.ts, mit eigenem kleinen Gerüst: dort geht es um
// Auth, Kontingent und Fehlerwege einer Nachricht, hier darum, was mit Dateien
// passiert. Das Muster ist dasselbe (PostgREST-Builder als thenable Kette, der
// Anbieter als vi.fn), nur dass zusätzlich der Service-Role-Client, über den
// geschrieben wird, und die Bytes im Bucket nachgestellt werden.

const getUser = vi.fn();
const rpc = vi.fn();
const chatCompleteStream = vi.fn();
const llmConfig = vi.fn();

// Der Service-Role-Client: alles, was Anhänge schreibt oder aus dem Bucket holt.
const upload = vi.fn();
const remove = vi.fn();
const download = vi.fn();
const adminInserts: { table: string; rows: Record<string, unknown>[] }[] = [];
const adminUpdates: { patch: unknown; filters: unknown[][] }[] = [];

// Zeilen, die der Nutzer-Client aus message_attachments liest: die, die der
// Test vorgibt, plus alles, was der Server in diesem Zug selbst eingefügt hat.
let seededAttachmentRows: Record<string, unknown>[] = [];
const storedRows: Record<string, unknown>[] = [];

const insertCalls: Record<string, unknown[]> = {};
const deleteCalls: Record<string, number> = {};
const tableResults: Record<string, { data?: unknown; error?: unknown; count?: number }> = {};

function userBuilder(table: string) {
  const result = () =>
    table === "message_attachments"
      ? { data: [...seededAttachmentRows, ...storedRows], error: null }
      : (tableResults[table] ?? { data: null, error: null, count: 0 });
  const chain: Record<string, unknown> = {
    maybeSingle: vi.fn(async () => result()),
    single: vi.fn(async () => result()),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };
  for (const method of ["select", "eq", "gte", "is", "in", "order", "limit", "update"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.insert = vi.fn((row: unknown) => {
    (insertCalls[table] ??= []).push(row);
    return chain;
  });
  chain.delete = vi.fn(() => {
    deleteCalls[table] = (deleteCalls[table] ?? 0) + 1;
    return chain;
  });
  return chain;
}

const supabaseStub = {
  auth: { getUser },
  from: (table: string) => userBuilder(table),
  rpc: (...args: unknown[]) => rpc(...args),
};

const admin = {
  storage: { from: () => ({ upload, remove, download }) },
  from: (table: string) => ({
    insert: async (rows: Record<string, unknown>[]) => {
      adminInserts.push({ table, rows });
      if (table === "message_attachments") storedRows.push(...rows);
      return { error: null };
    },
    update: (patch: unknown) => {
      const record = { patch, filters: [] as unknown[][] };
      adminUpdates.push(record);
      const chain = {
        eq: (...args: unknown[]) => {
          record.filters.push(args);
          return chain;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return chain;
    },
  }),
};

vi.mock("@/server/supabase/server", () => ({ createClient: async () => supabaseStub }));
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/server/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/security/rate-limit")>();
  return {
    ...actual,
    rateLimit: async () => ({ allowed: true, remaining: 119, resetAt: Date.now() + 1000 }),
    rateLimitKey: () => "u:user-1",
    reserveMonthlyQuota: async () => null,
    reserveServerKeyCall: async () => null,
  };
});
vi.mock("@/server/byok", () => ({ getUserOverride: async () => null }));
vi.mock("@/server/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/llm")>();
  return {
    ...actual,
    chatCompleteStream: (...a: unknown[]) => chatCompleteStream(...a),
    llmConfig: () => llmConfig(),
  };
});

// ─── Testdaten ─────────────────────────────────────────────────────────────
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64");
const shot = { name: "screen.png", mediaType: "image/png", data: b64(PNG) };
const notes = { name: "notes.md", mediaType: "text/markdown", data: b64("# Anforderungen\nLogin mit E-Mail") };

const OLD_USER_ID = "11111111-1111-4111-8111-111111111111";
const OLD_REPLY_ID = "22222222-2222-4222-8222-222222222222";
const NEW_ID = "33333333-3333-4333-8333-333333333333";
const CONVERSATION_ID = "44444444-4444-4444-8444-444444444444";

function req(body: unknown) {
  return new Request("https://promptprinter.app/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function turn(attachments?: unknown[], extra: Record<string, unknown> = {}) {
  return {
    messages: [{ role: "user", content: "Bau das nach", ...(attachments ? { attachments } : {}) }],
    ...extra,
  };
}

/** Was der Anbieter-Mock zuletzt als Verlauf bekam. */
function modelMessages(): { role: string; content: string; images?: unknown[] }[] {
  const call = chatCompleteStream.mock.calls.at(-1);
  return (call?.[0] as { messages: never[] }).messages;
}

describe("POST /api/chat, attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const t of Object.keys(insertCalls)) delete insertCalls[t];
    for (const t of Object.keys(deleteCalls)) delete deleteCalls[t];
    adminInserts.length = 0;
    adminUpdates.length = 0;
    storedRows.length = 0;
    seededAttachmentRows = [];

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockResolvedValue({ data: 0, error: null });
    llmConfig.mockReturnValue({ provider: "zai", model: "glm-4.5-air" });
    chatCompleteStream.mockImplementation(async function* () {
      yield "Alles klar";
    });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    download.mockResolvedValue({ data: new Blob([PNG]), error: null });

    tableResults.profiles = { data: { plan: "pro", is_admin: false } };
    tableResults.messages = { data: { id: NEW_ID }, error: null, count: 3 };
    tableResults.conversations = { data: { id: CONVERSATION_ID }, error: null };
    tableResults.projects = { data: null, error: null };
  });

  describe("refusing a bad attachment, before anything is written", () => {
    it.each([
      ["a format that is not accepted", { ...notes, name: "report.pdf" }, 400, "unsupported"],
      ["a file that only claims to be an image", { ...shot, data: b64("plain text") }, 400, "invalid"],
      ["an image over the size limit", { ...shot, data: b64(Buffer.alloc(MAX_ATTACHMENT_IMAGE_BYTES + 1, 1)) }, 413, "tooLarge"],
    ])("answers %s with a clean error and touches nothing", async (_label, bad, status, reason) => {
      // Der PNG-Kopf, damit "zu gross" an der Grösse scheitert und nicht an den Bytes.
      const attachment =
        reason === "tooLarge"
          ? { ...bad, data: b64(Buffer.concat([PNG, Buffer.alloc(MAX_ATTACHMENT_IMAGE_BYTES, 1)])) }
          : bad;

      const res = await POST(req(turn([attachment])));

      expect(res.status).toBe(status);
      expect(((await res.json()) as { reason?: string }).reason).toBe(reason);
      expect(upload).not.toHaveBeenCalled();
      expect(insertCalls.conversations).toBeUndefined();
      expect(insertCalls.messages).toBeUndefined();
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("answers a full attachment storage with 403 and says how much there is", async () => {
      rpc.mockResolvedValue({ data: MAX_ATTACHMENT_STORAGE_PER_USER - 1, error: null });

      const res = await POST(req(turn([shot])));

      expect(res.status).toBe(403);
      const json = (await res.json()) as { kind?: string; detail: string };
      expect(json.kind).toBe("attachmentStorage");
      expect(json.detail).toContain("100 MB");
      expect(upload).not.toHaveBeenCalled();
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });

    it("still takes a message that exactly fills the storage", async () => {
      rpc.mockResolvedValue({ data: MAX_ATTACHMENT_STORAGE_PER_USER - PNG.length, error: null });
      expect((await POST(req(turn([shot])))).status).toBe(200);
    });

    it("answers 503 and stores nothing when the storage check itself fails", async () => {
      rpc.mockResolvedValue({ data: null, error: new Error("function attachment_bytes_used does not exist") });

      const res = await POST(req(turn([shot])));

      expect(res.status).toBe(503);
      expect(upload).not.toHaveBeenCalled();
    });

    it("does not even ask for the storage sum when nothing is attached", async () => {
      await POST(req(turn()));
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe("an accepted turn", () => {
    it("stores both files under the user's own folder and links them to the new message", async () => {
      const res = await POST(req(turn([shot, notes])));
      await res.text();

      expect(res.status).toBe(200);
      const paths = upload.mock.calls.map((c) => c[0] as string);
      expect(paths).toHaveLength(2);
      for (const path of paths) expect(path).toMatch(new RegExp(`^user-1/${CONVERSATION_ID}/`));

      const rows = adminInserts.find((i) => i.table === "message_attachments")?.rows ?? [];
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row).toMatchObject({ user_id: "user-1", conversation_id: CONVERSATION_ID, message_id: NEW_ID });
      }
      expect(rows.map((r) => r.kind).sort()).toEqual(["image", "text"]);
    });

    it("gives the model the image and the file text, and keeps the user's own words first", async () => {
      await (await POST(req(turn([shot, notes])))).text();

      const last = modelMessages().at(-1)!;
      expect(last.role).toBe("user");
      expect(last.content.startsWith("Bau das nach")).toBe(true);
      expect(last.content).toContain('<attached_file name="notes.md">');
      expect(last.content).toContain("Login mit E-Mail");
      expect(last.content).toContain('<attached_image name="screen.png"/>');
      expect(last.images).toEqual([{ mediaType: "image/png", base64: PNG.toString("base64") }]);
    });

    it("uses the bytes it just uploaded instead of downloading them again", async () => {
      await (await POST(req(turn([shot])))).text();
      expect(download).not.toHaveBeenCalled();
    });

    it("sends a message without attachments exactly as before", async () => {
      await (await POST(req(turn()))).text();
      expect(modelMessages()).toEqual([{ role: "user", content: "Bau das nach" }]);
      expect(upload).not.toHaveBeenCalled();
    });

    it("lets the stub answer without touching the bucket for the model", async () => {
      llmConfig.mockReturnValue(null);
      const body = await (await POST(req(turn([shot])))).text();
      expect(body).toContain("Demo-Antwort");
      expect(chatCompleteStream).not.toHaveBeenCalled();
    });
  });

  describe("a failed turn takes its files with it", () => {
    it("removes the objects again when the provider fails", async () => {
      chatCompleteStream.mockImplementation(async function* () {
        throw Object.assign(new Error("boom"), { status: 500 });
      });

      const body = await (await POST(req(turn([shot, notes])))).text();

      expect(body).toContain("event: error");
      const stored = upload.mock.calls.map((c) => c[0] as string).sort();
      expect(remove.mock.calls.flatMap((c) => c[0] as string[]).sort()).toEqual(stored);
      // Die Konversation wurde in diesem Zug angelegt, also geht sie wieder
      // weg, und die Anhangs-Zeilen kaskadieren mit.
      expect(deleteCalls.conversations).toBe(1);
    });

    it("answers 503 and leaves no question behind when an upload fails", async () => {
      upload.mockResolvedValue({ error: new Error("storage down") });

      const res = await POST(req(turn([shot])));

      expect(res.status).toBe(503);
      expect(chatCompleteStream).not.toHaveBeenCalled();
      expect(deleteCalls.conversations).toBe(1);
    });
  });

  describe("attachments of earlier messages", () => {
    const history = (extra: Record<string, unknown> = {}) => ({
      conversationId: CONVERSATION_ID,
      messages: [
        { role: "user", content: "Das ist mein Entwurf", id: OLD_USER_ID },
        { role: "assistant", content: "Schön, ich sehe ein Dashboard." },
        { role: "user", content: "Mach die Seitenleiste dunkel" },
      ],
      ...extra,
    });

    const oldRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      message_id: OLD_USER_ID,
      name: "entwurf.png",
      kind: "image",
      media_type: "image/png",
      size_bytes: PNG.length,
      storage_path: `user-1/${CONVERSATION_ID}/aaaaaaaa.png`,
    };

    it("looks them up by message id and shows them to the model again", async () => {
      seededAttachmentRows = [oldRow];

      await (await POST(req(history()))).text();

      const messages = modelMessages();
      expect(messages[0].images).toEqual([{ mediaType: "image/png", base64: PNG.toString("base64") }]);
      expect(messages[0].content).toContain('<attached_image name="entwurf.png"/>');
      // Die neue Frage hat keine Anhänge und bleibt reiner Text.
      expect(messages[2]).toEqual({ role: "user", content: "Mach die Seitenleiste dunkel" });
    });

    it("tells the model when an old object is gone instead of leaving a silent gap", async () => {
      seededAttachmentRows = [oldRow];
      download.mockResolvedValue({ data: null, error: new Error("not found") });

      await (await POST(req(history()))).text();

      const first = modelMessages()[0];
      expect(first.images).toBeUndefined();
      expect(first.content).toContain('[Attached image "entwurf.png" is not available to you in this turn.]');
    });

    it("carries on as plain text when the lookup fails, e.g. before the migration ran", async () => {
      seededAttachmentRows = [oldRow];
      const original = supabaseStub.from;
      supabaseStub.from = (table: string) => {
        if (table === "message_attachments") {
          const failing: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) =>
              resolve({ data: null, error: new Error('relation "message_attachments" does not exist') }),
          };
          for (const m of ["select", "eq", "in", "order"]) failing[m] = () => failing;
          return failing as never;
        }
        return original(table) as never;
      };
      try {
        const res = await POST(req(history()));
        await res.text();
        expect(res.status).toBe(200);
        expect(modelMessages()[0]).toEqual({ role: "user", content: "Das ist mein Entwurf" });
      } finally {
        supabaseStub.from = original;
      }
    });

    it("never reads attachments from a message id that is not a uuid", async () => {
      seededAttachmentRows = [oldRow];
      const body = history();
      (body.messages[0] as { id?: string }).id = "client-side-id";

      await (await POST(req(body))).text();

      expect(modelMessages()[0].images).toBeUndefined();
    });
  });

  describe("regenerating", () => {
    it("shows the stored attachments of the question again, and uploads nothing", async () => {
      seededAttachmentRows = [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          message_id: OLD_USER_ID,
          name: "entwurf.png",
          kind: "image",
          media_type: "image/png",
          size_bytes: PNG.length,
          storage_path: `user-1/${CONVERSATION_ID}/bbbbbbbb.png`,
        },
      ];

      await (
        await POST(
          req({
            conversationId: CONVERSATION_ID,
            replaceMessageId: OLD_REPLY_ID,
            // Auch ein mitgeschickter Anhang zählt hier nicht: es gibt keine neue Frage.
            messages: [{ role: "user", content: "Bau das nach", id: OLD_USER_ID, attachments: [shot] }],
          })
        )
      ).text();

      expect(upload).not.toHaveBeenCalled();
      expect(modelMessages()[0].images).toHaveLength(1);
    });
  });

  describe("editing a message that carries attachments", () => {
    const edit = () => ({
      conversationId: CONVERSATION_ID,
      messages: [{ role: "user", content: "Bau das nach, aber in Blau" }],
      inheritAttachmentsFrom: OLD_USER_ID,
      supersededMessageIds: [OLD_USER_ID, OLD_REPLY_ID],
    });

    const oldRow = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      message_id: OLD_USER_ID,
      name: "entwurf.png",
      kind: "image",
      media_type: "image/png",
      size_bytes: PNG.length,
      storage_path: `user-1/${CONVERSATION_ID}/cccccccc.png`,
    };

    it("shows the model the old attachments with the new wording", async () => {
      seededAttachmentRows = [oldRow];

      await (await POST(req(edit()))).text();

      const last = modelMessages().at(-1)!;
      expect(last.content.startsWith("Bau das nach, aber in Blau")).toBe(true);
      expect(last.images).toHaveLength(1);
    });

    it("moves the files to the new message once the turn succeeded", async () => {
      seededAttachmentRows = [oldRow];

      await (await POST(req(edit()))).text();

      const move = adminUpdates.find((u) => (u.patch as { message_id?: string }).message_id === NEW_ID);
      expect(move).toBeDefined();
      expect(move!.filters).toContainEqual(["message_id", OLD_USER_ID]);
      expect(move!.filters).toContainEqual(["user_id", "user-1"]);
    });

    it("leaves the old message and its files alone when the provider fails", async () => {
      seededAttachmentRows = [oldRow];
      chatCompleteStream.mockImplementation(async function* () {
        throw Object.assign(new Error("boom"), { status: 500 });
      });

      await (await POST(req(edit()))).text();

      expect(adminUpdates).toHaveLength(0);
      expect(remove).not.toHaveBeenCalled();
    });

    // Bearbeitet man eine Frage weiter oben im Chat, fallen spätere Nachrichten
    // weg, auch solche mit Anhängen. Die Kaskade nimmt die Zeilen mit, aber nur
    // dieser Schritt kann die Objekte im Bucket mitnehmen.
    it("removes the files of messages it throws away", async () => {
      seededAttachmentRows = [oldRow];
      const body = { ...edit() } as Record<string, unknown>;
      delete body.inheritAttachmentsFrom;

      await (await POST(req(body))).text();

      expect(remove).toHaveBeenCalledWith([oldRow.storage_path]);
    });

    it("ignores inheritAttachmentsFrom when the request does not also list that message as superseded", async () => {
      seededAttachmentRows = [oldRow];
      const body = { ...edit(), supersededMessageIds: [OLD_REPLY_ID] };

      await (await POST(req(body))).text();

      expect(modelMessages().at(-1)!.images).toBeUndefined();
      expect(adminUpdates).toHaveLength(0);
    });
  });
});

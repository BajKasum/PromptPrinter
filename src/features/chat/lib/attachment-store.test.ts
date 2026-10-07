import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachmentError,
  adoptAttachments,
  attachmentBytesUsed,
  collectAttachmentPaths,
  downloadAttachment,
  groupByMessage,
  loadAttachmentRecords,
  removeStoredObjects,
  signImageUrls,
  sniffImageType,
  storeAttachments,
  toAttachmentView,
  validateUploads,
} from "@/features/chat/lib/attachment-store";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENT_TEXT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENTS_REQUEST_BYTES,
} from "@/shared/lib/chat-limits";

// ─── Der Service-Role-Client, durch den alles Schreibende läuft ────────────
const upload = vi.fn();
const remove = vi.fn();
const download = vi.fn();
const insert = vi.fn();
const updateEq = vi.fn();

const admin = {
  storage: { from: () => ({ upload, remove, download }) },
  from: () => ({
    insert,
    update: (patch: unknown) => {
      const chain = {
        eq: (...args: unknown[]) => {
          updateEq(patch, ...args);
          return chain;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return chain;
    },
  }),
};
vi.mock("@/server/supabase/admin", () => ({ createAdminClient: () => admin }));

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
});

// ─── Testbytes ─────────────────────────────────────────────────────────────
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (extra = 8) => Buffer.from([...PNG_HEAD, ...new Array(extra).fill(1)]);
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const webp = () =>
  Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from("VP8 ")]);

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64");

function image(name = "shot.png", bytes: Buffer = png()) {
  return { name, mediaType: "image/png", data: b64(bytes) };
}
function textFile(name = "notes.md", text = "# Notizen") {
  return { name, mediaType: "text/markdown", data: b64(text) };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof AttachmentError ? err.code : `other:${String(err)}`;
  }
  return undefined;
}

describe("sniffImageType", () => {
  it("knows the three accepted formats by their first bytes", () => {
    expect(sniffImageType(png())).toBe("image/png");
    expect(sniffImageType(jpeg())).toBe("image/jpeg");
    expect(sniffImageType(webp())).toBe("image/webp");
  });

  it("refuses everything else, however it is named", () => {
    expect(sniffImageType(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(Buffer.from([]))).toBeNull();
    // RIFF-Container, der kein WebP ist (zum Beispiel WAV).
    expect(
      sniffImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WAVEfmt ")]))
    ).toBeNull();
  });
});

// Folgesitzung 2026-10-07 (Dateigroesse, attachment-store.ts wird zerlegt): Mutationen gegen die
// Pruefung zeigten Luecken an den Raendern. Hier festgenagelt, bevor sich die Datei aendert.
describe("sniffImageType: Raender der Signaturen", () => {
  it("nimmt ein JPEG schon an den ersten drei Bytes", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
  });

  it("weist ein JPEG ab, dem ein Byte fehlt oder das falsch beginnt", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0x00, 0xe0]))).toBeNull(); // drittes Byte falsch
    expect(sniffImageType(Buffer.from([0x00, 0xd8, 0xff, 0xe0]))).toBeNull(); // erstes Byte falsch
    expect(sniffImageType(Buffer.from([0xff, 0x00, 0xff, 0xe0]))).toBeNull(); // zweites Byte falsch
  });

  it("weist ein PNG ab, dessen Signatur an irgendeiner Stelle abweicht oder zu kurz ist", () => {
    for (let i = 0; i < PNG_HEAD.length; i++) {
      const broken = [...PNG_HEAD, 1, 1];
      broken[i] ^= 0xff;
      expect(sniffImageType(Buffer.from(broken)), `Byte ${i}`).toBeNull();
    }
    expect(sniffImageType(Buffer.from(PNG_HEAD.slice(0, 7)))).toBeNull();
    expect(sniffImageType(Buffer.from(PNG_HEAD))).toBe("image/png"); // genau die acht Bytes
  });

  it("weist ein WebP ab, dessen Container nicht RIFF heisst oder dessen Typ nicht WEBP ist", () => {
    const body = Buffer.concat([Buffer.from([1, 0, 0, 0])]);
    expect(sniffImageType(Buffer.concat([Buffer.from("XXXX"), body, Buffer.from("WEBPVP8 ")]))).toBeNull();
    expect(sniffImageType(Buffer.concat([Buffer.from("RIFF"), body, Buffer.from("WEBQVP8 ")]))).toBeNull();
    expect(sniffImageType(Buffer.concat([Buffer.from("RIFF"), body, Buffer.from("WEBP")]))).toBe("image/webp"); // genau 12 Bytes
    expect(sniffImageType(Buffer.concat([Buffer.from("RIFF"), body, Buffer.from("WEB")]))).toBeNull(); // 11 Bytes
  });
});

describe("validateUploads: Raender und Einzelheiten", () => {
  it("nimmt genau so viele Anhaenge, wie eine Nachricht tragen darf", () => {
    const exactly = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => textFile(`n${i}.txt`));
    expect(validateUploads(exactly)).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
  });

  it("nimmt genau die Summe, die eine Anfrage tragen darf, und weist ein Byte mehr ab", () => {
    // Zwei Bilder von genau 1 MB (Einzelgrenze) sind genau die Anfragegrenze (2 MB).
    const edge = png(MAX_ATTACHMENT_IMAGE_BYTES - PNG_HEAD.length);
    expect(edge.length).toBe(MAX_ATTACHMENT_IMAGE_BYTES);
    const exactly = [image("a.png", edge), image("b.png", edge)];
    expect(exactly.reduce((sum, u) => sum + Buffer.from(u.data, "base64").length, 0)).toBe(MAX_ATTACHMENTS_REQUEST_BYTES);
    expect(validateUploads(exactly)).toHaveLength(2);

    expect(codeOf(() => validateUploads([...exactly, textFile("one-more.txt", "x")]))).toBe("tooLargeTotal");
  });

  it("weist Base64 mit zu vielen Fuellzeichen ab, auch wenn es sich dekodieren liesse", () => {
    // "QUJD" = "ABC"; vier Fuellzeichen dahinter sind kein gueltiges Base64 (hoechstens zwei).
    expect(codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "QUJD====" }]))).toBe("invalid");
    expect(codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "QUJDQQ==" }]))).toBeUndefined();
  });

  it("weist Base64 mit Leerzeichen mittendrin ab (das Alphabet kennt keine)", () => {
    expect(codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "QUJD QUJ" }]))).toBe("invalid");
    expect(codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "QUJD\nQUJD" }]))).toBe("invalid");
  });

  it("weist eine leere Datei ab (Base64 ohne Zeichen)", () => {
    expect(codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "" }]))).toBe("invalid");
  });

  it("nennt in jedem Fehler den bereinigten Dateinamen, ausser bei zu vielen Anhaengen", () => {
    const err = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e as AttachmentError;
      }
      throw new Error("kein Fehler");
    };
    expect(err(() => validateUploads([textFile("dir/report.pdf")])).attachmentName).toBe("report.pdf");
    expect(err(() => validateUploads([image("x/fake.png", Buffer.from("no"))])).attachmentName).toBe("fake.png");
    expect(err(() => validateUploads([textFile("big.txt", "x".repeat(MAX_ATTACHMENT_TEXT_BYTES + 1))])).attachmentName).toBe("big.txt");
    expect(err(() => validateUploads(Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, () => textFile()))).attachmentName).toBeUndefined();
  });
});

describe("validateUploads", () => {
  it("accepts a screenshot and a text file and gives each an id, a clean name and its real type", () => {
    const out = validateUploads([image("a/b/shot.png"), textFile()]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: "shot.png", kind: "image", mediaType: "image/png" });
    expect(out[1]).toMatchObject({ name: "notes.md", kind: "text", mediaType: "text/plain" });
    expect(out[0].id).not.toBe(out[1].id);
    expect(out[1].bytes.toString("utf8")).toBe("# Notizen");
  });

  // Der Typ, den der Browser behauptet, zählt nicht: die Bytes entscheiden.
  it("takes the media type from the bytes, not from what the client claims", () => {
    const out = validateUploads([{ name: "photo.jpg", mediaType: "image/png", data: b64(jpeg()) }]);
    expect(out[0].mediaType).toBe("image/jpeg");
  });

  it("treats a text file as plain text whatever its extension says it is", () => {
    const out = validateUploads([textFile("page.html", "<h1>hi</h1>")]);
    expect(out[0].mediaType).toBe("text/plain");
  });

  it("refuses a format it does not take", () => {
    expect(codeOf(() => validateUploads([textFile("report.pdf")]))).toBe("unsupported");
    expect(codeOf(() => validateUploads([textFile("clip.mp4")]))).toBe("unsupported");
    expect(codeOf(() => validateUploads([textFile("IMG_1.heic")]))).toBe("unsupported");
  });

  it("refuses a file named like an image that is not one", () => {
    expect(codeOf(() => validateUploads([image("fake.png", Buffer.from("not an image at all"))]))).toBe(
      "invalid"
    );
  });

  it("refuses an HTML file dressed up as a PNG", () => {
    expect(codeOf(() => validateUploads([image("x.png", Buffer.from("<script>alert(1)</script>"))]))).toBe(
      "invalid"
    );
  });

  it("refuses text that is not valid UTF-8", () => {
    const latin1 = Buffer.from([0x48, 0xe4, 0x6c, 0x6c, 0x6f]); // "Hällo" in Latin-1
    expect(codeOf(() => validateUploads([{ name: "alt.txt", mediaType: "text/plain", data: b64(latin1) }]))).toBe(
      "invalid"
    );
  });

  it("refuses a text file that is really binary", () => {
    expect(codeOf(() => validateUploads([textFile("data.txt", "abc\u0000def")]))).toBe("invalid");
  });

  it("refuses malformed or empty Base64", () => {
    expect(
      codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "not base64!!" }]))
    ).toBe("invalid");
    expect(codeOf(() => validateUploads([{ name: "a.txt", mediaType: "text/plain", data: "QUJ" }]))).toBe(
      "invalid"
    );
  });

  it("holds an image to the image limit and a text file to the text limit", () => {
    const bigImage = png(MAX_ATTACHMENT_IMAGE_BYTES);
    expect(codeOf(() => validateUploads([image("big.png", bigImage)]))).toBe("tooLarge");
    const bigText = "x".repeat(MAX_ATTACHMENT_TEXT_BYTES + 1);
    expect(codeOf(() => validateUploads([textFile("big.txt", bigText)]))).toBe("tooLarge");
  });

  it("accepts a file exactly at its limit", () => {
    const edge = "x".repeat(MAX_ATTACHMENT_TEXT_BYTES);
    expect(validateUploads([textFile("edge.txt", edge)])).toHaveLength(1);
  });

  it("refuses more attachments than one message may carry", () => {
    const tooMany = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 1 }, () => textFile());
    expect(codeOf(() => validateUploads(tooMany))).toBe("tooMany");
  });

  it("refuses attachments that are fine one by one but too large together", () => {
    // Drei Bilder knapp unter der Einzelgrenze: zusammen über der Anfragegrenze.
    const each = Math.floor(MAX_ATTACHMENTS_REQUEST_BYTES / 2.5);
    const files = [1, 2, 3].map((i) => image(`s${i}.png`, png(each - PNG_HEAD.length)));
    expect(each).toBeLessThanOrEqual(MAX_ATTACHMENT_IMAGE_BYTES);
    expect(codeOf(() => validateUploads(files))).toBe("tooLargeTotal");
  });

  it("rejects an oversized upload before decoding it", () => {
    const spy = vi.spyOn(Buffer, "from");
    const huge = { name: "huge.txt", mediaType: "text/plain", data: "A".repeat(4 * 1024 * 1024) };
    expect(codeOf(() => validateUploads([huge]))).toBe("tooLargeTotal");
    // Weder die Prüfung noch irgendeine Dekodierung hat einen 3-MB-Buffer gebaut.
    const calls = spy.mock.calls as unknown[][];
    expect(calls.some(([value, enc]) => typeof value === "string" && enc === "base64")).toBe(false);
    spy.mockRestore();
  });

  it("reduces a hostile file name to its last path part", () => {
    expect(validateUploads([textFile("../../etc/passwd.txt")])[0].name).toBe("passwd.txt");
  });
});

describe("storeAttachments", () => {
  const validated = () => validateUploads([image("shot.png"), textFile("notes.md")]);

  it("uploads each object under {user}/{conversation}/{id}, then writes the rows", async () => {
    const files = validated();
    const records = await storeAttachments({
      userId: "u1",
      conversationId: "c1",
      messageId: "m1",
      attachments: files,
    });

    expect(upload).toHaveBeenCalledTimes(2);
    const [path0, , options0] = upload.mock.calls[0];
    expect(path0).toBe(`u1/c1/${files[0].id}.png`);
    expect(options0).toEqual({ contentType: "image/png", upsert: false });
    expect(upload.mock.calls[1][0]).toBe(`u1/c1/${files[1].id}.txt`);
    expect(upload.mock.calls[1][2]).toEqual({ contentType: "text/plain", upsert: false });

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({
      id: files[0].id,
      user_id: "u1",
      conversation_id: "c1",
      message_id: "m1",
      name: "shot.png",
      kind: "image",
      media_type: "image/png",
      size_bytes: files[0].bytes.length,
      storage_path: `u1/c1/${files[0].id}.png`,
    });
    expect(records.map((r) => r.id)).toEqual(files.map((f) => f.id));
  });

  it("never puts the user's file name into the storage path", async () => {
    const files = validateUploads([textFile("geheim-projekt.md")]);
    const [record] = await storeAttachments({
      userId: "u1",
      conversationId: "c1",
      messageId: "m1",
      attachments: files,
    });
    expect(record.storagePath).not.toContain("geheim");
  });

  it("removes what it already uploaded when a later upload fails, and writes no rows", async () => {
    const files = validated();
    upload.mockImplementation(async (path: string) =>
      path.endsWith(".txt") ? { error: new Error("storage down") } : { error: null }
    );

    await expect(
      storeAttachments({ userId: "u1", conversationId: "c1", messageId: "m1", attachments: files })
    ).rejects.toThrow("storage down");

    expect(insert).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([`u1/c1/${files[0].id}.png`]);
  });

  it("removes every object again when writing the rows fails", async () => {
    const files = validated();
    insert.mockResolvedValue({ error: new Error("row rejected") });

    await expect(
      storeAttachments({ userId: "u1", conversationId: "c1", messageId: "m1", attachments: files })
    ).rejects.toThrow("row rejected");

    expect(remove).toHaveBeenCalledWith([
      `u1/c1/${files[0].id}.png`,
      `u1/c1/${files[1].id}.txt`,
    ]);
  });
});

describe("removeStoredObjects", () => {
  it("does nothing for an empty list", async () => {
    expect(await removeStoredObjects([])).toEqual({ removed: 0, failed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("reports what it removed", async () => {
    expect(await removeStoredObjects(["a", "b"])).toEqual({ removed: 2, failed: 0 });
  });

  // Aufräumen darf nie selbst zum Fehler werden: ein Waisen-Objekt kostet nur Platz.
  it("never throws, a failed cleanup is counted instead", async () => {
    remove.mockRejectedValue(new Error("network"));
    expect(await removeStoredObjects(["a", "b", "c"])).toEqual({ removed: 0, failed: 3 });
  });
});

describe("downloadAttachment", () => {
  it("returns the bytes", async () => {
    download.mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
    expect((await downloadAttachment("u/c/x.png"))?.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("returns null for a missing object instead of throwing", async () => {
    download.mockResolvedValue({ data: null, error: new Error("not found") });
    expect(await downloadAttachment("u/c/gone.png")).toBeNull();
  });

  it("returns null when the call itself blows up", async () => {
    download.mockRejectedValue(new Error("network"));
    expect(await downloadAttachment("u/c/x.png")).toBeNull();
  });
});

describe("adoptAttachments", () => {
  it("re-points the rows to the new message, scoped to owner and conversation", async () => {
    await adoptAttachments({
      userId: "u1",
      conversationId: "c1",
      fromMessageId: "old",
      toMessageId: "new",
    });
    const calls = updateEq.mock.calls.map(([patch, col, val]) => [col, val, patch]);
    expect(calls).toContainEqual(["user_id", "u1", { message_id: "new" }]);
    expect(calls).toContainEqual(["conversation_id", "c1", { message_id: "new" }]);
    expect(calls).toContainEqual(["message_id", "old", { message_id: "new" }]);
  });
});

// ─── Nutzer-Client: nachschlagen, signieren ────────────────────────────────

function userClient(result: { data?: unknown; error?: unknown }, extra: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[][]> = {};
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null, ...result }),
  };
  for (const m of ["select", "eq", "in", "order"]) {
    chain[m] = (...args: unknown[]) => {
      (calls[m] ??= []).push(args);
      return chain;
    };
  }
  return {
    calls,
    client: { from: () => chain, ...extra } as never,
  };
}

describe("loadAttachmentRecords", () => {
  const row = {
    id: "a1",
    message_id: "m1",
    name: "shot.png",
    kind: "image",
    media_type: "image/png",
    size_bytes: 123,
    storage_path: "u1/c1/a1.png",
  };

  it("returns camelCase records, scoped to the owner and the conversation", async () => {
    const { client, calls } = userClient({ data: [row] });
    const records = await loadAttachmentRecords(client, "u1", "c1", ["m1", "m2"]);

    expect(records).toEqual([
      {
        id: "a1",
        messageId: "m1",
        name: "shot.png",
        kind: "image",
        mediaType: "image/png",
        sizeBytes: 123,
        storagePath: "u1/c1/a1.png",
      },
    ]);
    expect(calls.eq).toContainEqual(["user_id", "u1"]);
    expect(calls.eq).toContainEqual(["conversation_id", "c1"]);
    expect(calls.in).toContainEqual(["message_id", ["m1", "m2"]]);
  });

  it("does not ask the database at all for no messages", async () => {
    const { client, calls } = userClient({ data: [row] });
    expect(await loadAttachmentRecords(client, "u1", "c1", [])).toEqual([]);
    expect(calls.select).toBeUndefined();
  });

  it("throws on a database error, so the caller can decide what it is worth", async () => {
    const { client } = userClient({ error: new Error("relation does not exist") });
    await expect(loadAttachmentRecords(client, "u1", "c1", ["m1"])).rejects.toThrow("relation");
  });
});

describe("collectAttachmentPaths", () => {
  it("lists the storage paths of the given messages", async () => {
    const { client } = userClient({ data: [{ storage_path: "p1" }, { storage_path: "p2" }] });
    expect(await collectAttachmentPaths(client, "u1", "c1", ["m1"])).toEqual(["p1", "p2"]);
  });
});

describe("attachmentBytesUsed", () => {
  it("returns the sum the database function reports", async () => {
    const rpc = vi.fn(async () => ({ data: "5242880", error: null }));
    const { client } = userClient({}, { rpc });
    expect(await attachmentBytesUsed(client)).toBe(5242880);
    expect(rpc).toHaveBeenCalledWith("attachment_bytes_used");
  });

  it("treats no data as zero", async () => {
    const { client } = userClient({}, { rpc: async () => ({ data: null, error: null }) });
    expect(await attachmentBytesUsed(client)).toBe(0);
  });

  it("throws when the function is missing (migration not applied)", async () => {
    const { client } = userClient({}, { rpc: async () => ({ data: null, error: new Error("no function") }) });
    await expect(attachmentBytesUsed(client)).rejects.toThrow("no function");
  });
});

describe("signImageUrls", () => {
  const records = [
    { id: "i1", messageId: "m1", name: "a.png", kind: "image", mediaType: "image/png", sizeBytes: 1, storagePath: "u/c/i1.png" },
    { id: "t1", messageId: "m1", name: "a.md", kind: "text", mediaType: "text/plain", sizeBytes: 1, storagePath: "u/c/t1.txt" },
  ] as const;

  it("signs only the images, by attachment id", async () => {
    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}`, error: null })),
    }));
    const { client } = userClient({}, { storage: { from: () => ({ createSignedUrls }) } });

    const urls = await signImageUrls(client, [...records]);

    expect(createSignedUrls).toHaveBeenCalledWith(["u/c/i1.png"], expect.any(Number));
    expect([...urls]).toEqual([["i1", "https://signed.test/u/c/i1.png"]]);
  });

  it("makes no call when there is no image", async () => {
    const createSignedUrls = vi.fn();
    const { client } = userClient({}, { storage: { from: () => ({ createSignedUrls }) } });
    expect((await signImageUrls(client, [records[1]])).size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  // Eine fehlende Vorschau darf nie eine Chat-Seite kippen.
  it("returns no urls instead of throwing when signing fails", async () => {
    const { client } = userClient(
      {},
      { storage: { from: () => ({ createSignedUrls: async () => Promise.reject(new Error("down")) }) } }
    );
    expect((await signImageUrls(client, [...records])).size).toBe(0);
  });
});

describe("groupByMessage / toAttachmentView", () => {
  it("groups records by their message, keeping order", () => {
    const grouped = groupByMessage([
      { id: "1", messageId: "m1", name: "a", kind: "text", mediaType: "text/plain", sizeBytes: 1, storagePath: "p1" },
      { id: "2", messageId: "m2", name: "b", kind: "text", mediaType: "text/plain", sizeBytes: 1, storagePath: "p2" },
      { id: "3", messageId: "m1", name: "c", kind: "text", mediaType: "text/plain", sizeBytes: 1, storagePath: "p3" },
    ]);
    expect(grouped.get("m1")?.map((r) => r.id)).toEqual(["1", "3"]);
    expect(grouped.get("m2")?.map((r) => r.id)).toEqual(["2"]);
  });

  it("builds a view without leaking the storage path", () => {
    const view = toAttachmentView(
      { id: "1", messageId: "m", name: "a.png", kind: "image", mediaType: "image/png", sizeBytes: 9, storagePath: "u/c/1.png" },
      "https://signed.test/x"
    );
    expect(view).toEqual({
      id: "1",
      name: "a.png",
      kind: "image",
      mediaType: "image/png",
      sizeBytes: 9,
      url: "https://signed.test/x",
    });
    expect(view).not.toHaveProperty("storagePath");
  });
});

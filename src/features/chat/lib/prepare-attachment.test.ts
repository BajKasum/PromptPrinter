import { describe, expect, it, vi } from "vitest";
import {
  MAX_IMAGE_SOURCE_BYTES,
  fitWithin,
  jpegName,
  prepareAttachment,
  type DecodedImage,
  type PrepareDeps,
} from "@/features/chat/lib/prepare-attachment";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENT_IMAGE_EDGE,
  MAX_ATTACHMENT_TEXT_BYTES,
} from "@/shared/lib/chat-limits";

// jsdom hat weder Canvas noch createImageBitmap: die Bild-Fähigkeiten kommen
// als Ersatz herein (PrepareDeps), alles andere läuft echt, auch File.

const toBase64 = vi.fn(async (blob: Blob) => Buffer.from(await blob.arrayBuffer()).toString("base64"));

function image(width: number, height: number, encoded: number[] = [100]) {
  // `encoded`: die Grössen, die aufeinanderfolgende encodeJpeg-Stufen liefern.
  const encodeJpeg = vi.fn(async (_w: number, _h: number, _q: number) => {
    const size = encoded[Math.min(encodeJpeg.mock.calls.length - 1, encoded.length - 1)];
    return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
  });
  const decoded: DecodedImage = { width, height, encodeJpeg, close: vi.fn() };
  const deps: PrepareDeps = { decodeImage: vi.fn(async () => decoded), toBase64 };
  return { deps, decoded, encodeJpeg };
}

const file = (name: string, content: string | Uint8Array, type = "") =>
  new File([content as BlobPart], name, { type });

describe("fitWithin", () => {
  it("leaves an image alone that already fits", () => {
    expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1568, 900, 1568)).toEqual({ width: 1568, height: 900 });
  });

  it("scales the longest edge down to the limit, keeping the proportions", () => {
    expect(fitWithin(3136, 1568, 1568)).toEqual({ width: 1568, height: 784 });
    expect(fitWithin(1000, 4000, 1000)).toEqual({ width: 250, height: 1000 });
  });

  it("never scales up and never reaches zero", () => {
    expect(fitWithin(100, 50, 1568)).toEqual({ width: 100, height: 50 });
    expect(fitWithin(5000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});

describe("jpegName", () => {
  it("swaps the extension so name and content agree", () => {
    expect(jpegName("screen.png")).toBe("screen.jpg");
    expect(jpegName("Foto.WEBP")).toBe("Foto.jpg");
    expect(jpegName("a.jpeg")).toBe("a.jpg");
  });

  it("appends one when there is none", () => {
    expect(jpegName("clipboard")).toBe("clipboard.jpg");
  });
});

describe("prepareAttachment: what is refused", () => {
  it("refuses a format that is not offered", async () => {
    const out = await prepareAttachment(file("report.pdf", "%PDF"), image(1, 1).deps);
    expect(out).toEqual({ ok: false, reason: "unsupported" });
  });

  it("refuses a photo too big to even read", async () => {
    const big = file("huge.png", "x");
    Object.defineProperty(big, "size", { value: MAX_IMAGE_SOURCE_BYTES + 1 });
    const { deps } = image(100, 100);
    expect(await prepareAttachment(big, deps)).toEqual({
      ok: false,
      reason: "tooLarge",
      maxBytes: MAX_IMAGE_SOURCE_BYTES,
    });
    expect(deps.decodeImage).not.toHaveBeenCalled();
  });

  it("calls an image the browser cannot decode unreadable", async () => {
    const deps: PrepareDeps = {
      decodeImage: vi.fn(async () => {
        throw new Error("bad image");
      }),
      toBase64,
    };
    expect(await prepareAttachment(file("broken.png", "not an image"), deps)).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});

describe("prepareAttachment: images", () => {
  it("keeps a small image as it is: same bytes, same type, no re-encoding", async () => {
    const { deps, encodeJpeg, decoded } = image(800, 600);
    const png = file("screen.png", "PNGDATA", "image/png");

    const out = await prepareAttachment(png, deps);

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.attachment).toMatchObject({
      name: "screen.png",
      kind: "image",
      mediaType: "image/png",
      sizeBytes: png.size,
      data: Buffer.from("PNGDATA").toString("base64"),
      previewUrl: `data:image/png;base64,${Buffer.from("PNGDATA").toString("base64")}`,
    });
    expect(encodeJpeg).not.toHaveBeenCalled();
    expect(decoded.close).toHaveBeenCalled();
  });

  it("takes the type from the extension when the browser reports none", async () => {
    const out = await prepareAttachment(file("bild.webp", "W"), image(10, 10).deps);
    expect(out.ok && out.attachment.mediaType).toBe("image/webp");
  });

  it("scales a large image down to the edge limit and re-encodes it as JPEG", async () => {
    const { deps, encodeJpeg } = image(4000, 2000, [200_000]);

    const out = await prepareAttachment(file("foto.png", "x", "image/png"), deps);

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.attachment).toMatchObject({ name: "foto.jpg", mediaType: "image/jpeg", sizeBytes: 200_000 });
    expect(out.attachment.previewUrl?.startsWith("data:image/jpeg;base64,")).toBe(true);
    const [w, h, quality] = encodeJpeg.mock.calls[0];
    expect(Math.max(w, h)).toBe(MAX_ATTACHMENT_IMAGE_EDGE);
    expect(w / h).toBeCloseTo(2, 1);
    expect(quality).toBe(0.85);
  });

  it("re-encodes an image of fine dimensions that is too heavy", async () => {
    const heavy = file("scan.png", new Uint8Array(MAX_ATTACHMENT_IMAGE_BYTES + 10), "image/png");
    const { deps, encodeJpeg } = image(1200, 800, [300_000]);

    const out = await prepareAttachment(heavy, deps);

    expect(encodeJpeg).toHaveBeenCalledTimes(1);
    expect(out.ok && out.attachment.mediaType).toBe("image/jpeg");
  });

  it("tries lower quality and then smaller sizes until it fits", async () => {
    const { deps, encodeJpeg } = image(3000, 3000, [
      MAX_ATTACHMENT_IMAGE_BYTES + 1,
      MAX_ATTACHMENT_IMAGE_BYTES + 1,
      MAX_ATTACHMENT_IMAGE_BYTES - 1,
    ]);

    const out = await prepareAttachment(file("detail.png", "x", "image/png"), deps);

    expect(encodeJpeg).toHaveBeenCalledTimes(3);
    const qualities = encodeJpeg.mock.calls.map((c) => c[2]);
    expect(qualities).toEqual([0.85, 0.72, 0.6]);
    // Die dritte Stufe verkleinert auch die Kantenlänge.
    expect(encodeJpeg.mock.calls[2][0]).toBeLessThan(encodeJpeg.mock.calls[0][0]);
    expect(out.ok && out.attachment.sizeBytes).toBe(MAX_ATTACHMENT_IMAGE_BYTES - 1);
  });

  it("gives up with tooLarge when no step gets it under the limit", async () => {
    const { deps, encodeJpeg } = image(3000, 3000, [MAX_ATTACHMENT_IMAGE_BYTES + 1]);
    const out = await prepareAttachment(file("noise.png", "x", "image/png"), deps);
    expect(encodeJpeg).toHaveBeenCalledTimes(4);
    expect(out).toEqual({ ok: false, reason: "tooLarge", maxBytes: MAX_ATTACHMENT_IMAGE_BYTES });
  });

  it("calls it unreadable when encoding produces nothing", async () => {
    const { deps, encodeJpeg } = image(3000, 3000);
    encodeJpeg.mockResolvedValue(null as never);
    expect(await prepareAttachment(file("x.png", "x", "image/png"), deps)).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("releases the decoded image on every path", async () => {
    const failing = image(3000, 3000);
    failing.encodeJpeg.mockRejectedValue(new Error("canvas lost"));
    const out = await prepareAttachment(file("x.png", "x", "image/png"), failing.deps);
    expect(out).toEqual({ ok: false, reason: "unreadable" });
    expect(failing.decoded.close).toHaveBeenCalled();
  });
});

describe("prepareAttachment: text files", () => {
  const noImages = image(1, 1).deps;

  it("takes a text file as it is, with its bytes as Base64", async () => {
    const md = file("README.md", "# Titel\nÄöü", "text/markdown");

    const out = await prepareAttachment(md, noImages);

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.attachment).toMatchObject({
      name: "README.md",
      kind: "text",
      mediaType: "text/plain",
      sizeBytes: md.size,
    });
    expect(Buffer.from(out.attachment.data, "base64").toString("utf8")).toBe("# Titel\nÄöü");
    expect(out.attachment.previewUrl).toBeUndefined();
  });

  it("refuses a file over the text limit", async () => {
    const big = file("log.txt", "x".repeat(MAX_ATTACHMENT_TEXT_BYTES + 1));
    expect(await prepareAttachment(big, noImages)).toEqual({
      ok: false,
      reason: "tooLarge",
      maxBytes: MAX_ATTACHMENT_TEXT_BYTES,
    });
  });

  it("refuses binary content in a file named like text", async () => {
    expect(await prepareAttachment(file("data.txt", "abc\u0000def"), noImages)).toEqual({
      ok: false,
      reason: "notText",
    });
  });

  it("refuses text in a different encoding instead of passing gibberish on", async () => {
    const latin1 = new Uint8Array([0x48, 0xe4, 0x6c, 0x6c, 0x6f]);
    expect(await prepareAttachment(file("alt.txt", latin1), noImages)).toEqual({
      ok: false,
      reason: "notText",
    });
  });

  it("gives every attachment its own id", async () => {
    const a = await prepareAttachment(file("a.md", "a"), noImages);
    const b = await prepareAttachment(file("a.md", "a"), noImages);
    expect(a.ok && b.ok && a.attachment.id !== b.attachment.id).toBe(true);
  });
});

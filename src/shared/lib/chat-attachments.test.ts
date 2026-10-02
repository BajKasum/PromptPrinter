import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ACCEPT,
  attachmentKindOf,
  base64DecodedLength,
  formatBytes,
  imageMediaTypeForName,
  isImageMediaType,
  maxBytesForAttachment,
  sanitizeAttachmentName,
} from "@/shared/lib/chat-attachments";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENT_TEXT_BYTES,
} from "@/shared/lib/chat-limits";

describe("attachmentKindOf", () => {
  it("calls screenshots and photos images", () => {
    expect(attachmentKindOf("dashboard.png")).toBe("image");
    expect(attachmentKindOf("IMG_0042.JPG")).toBe("image");
    expect(attachmentKindOf("hero.webp")).toBe("image");
  });

  it("calls docs, config and code text", () => {
    expect(attachmentKindOf("README.md")).toBe("text");
    expect(attachmentKindOf("package.json")).toBe("text");
    expect(attachmentKindOf("page.tsx")).toBe("text");
    expect(attachmentKindOf("schema.sql")).toBe("text");
  });

  // Ein Lockfile ist als Chat-Anhang Text mit der Textgrenze, keine eigene Art.
  it("treats lockfiles as text", () => {
    expect(attachmentKindOf("package-lock.json")).toBe("text");
    expect(attachmentKindOf("yarn.lock")).toBe("text");
  });

  it("refuses what is neither", () => {
    expect(attachmentKindOf("report.pdf")).toBeNull();
    expect(attachmentKindOf("archive.zip")).toBeNull();
    expect(attachmentKindOf("clip.mp4")).toBeNull();
    expect(attachmentKindOf("IMG_0042.heic")).toBeNull();
    expect(attachmentKindOf("README")).toBeNull();
  });

  it("looks at the real suffix, not at a suffix hidden earlier in the name", () => {
    expect(attachmentKindOf("notes.md.exe")).toBeNull();
  });
});

describe("imageMediaTypeForName / isImageMediaType", () => {
  it("maps the three accepted image extensions", () => {
    expect(imageMediaTypeForName("a.png")).toBe("image/png");
    expect(imageMediaTypeForName("a.jpg")).toBe("image/jpeg");
    expect(imageMediaTypeForName("a.JPEG")).toBe("image/jpeg");
    expect(imageMediaTypeForName("a.webp")).toBe("image/webp");
    expect(imageMediaTypeForName("a.gif")).toBeNull();
  });

  it("accepts exactly the three image types", () => {
    expect(isImageMediaType("image/png")).toBe(true);
    expect(isImageMediaType("image/jpeg")).toBe(true);
    expect(isImageMediaType("image/webp")).toBe(true);
    expect(isImageMediaType("image/svg+xml")).toBe(false);
    expect(isImageMediaType("image/gif")).toBe(false);
    expect(isImageMediaType("text/html")).toBe(false);
  });
});

describe("maxBytesForAttachment", () => {
  it("has one ceiling per kind", () => {
    expect(maxBytesForAttachment("image")).toBe(MAX_ATTACHMENT_IMAGE_BYTES);
    expect(maxBytesForAttachment("text")).toBe(MAX_ATTACHMENT_TEXT_BYTES);
  });
});

describe("ATTACHMENT_ACCEPT", () => {
  it("offers extensions and the image types to the file dialog", () => {
    const accepted = ATTACHMENT_ACCEPT.split(",");
    expect(accepted).toContain(".png");
    expect(accepted).toContain(".md");
    expect(accepted).toContain("image/webp");
  });
});

describe("sanitizeAttachmentName", () => {
  it("keeps an ordinary name", () => {
    expect(sanitizeAttachmentName("Screenshot 2026-10-02.png")).toBe("Screenshot 2026-10-02.png");
  });

  it("drops directory parts, whichever way they are written", () => {
    expect(sanitizeAttachmentName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeAttachmentName("C:\\Users\\kasum\\notes.md")).toBe("notes.md");
  });

  it("replaces control characters and collapses whitespace", () => {
    expect(sanitizeAttachmentName("a\u0000b\nc\td.txt")).toBe("a b c d.txt");
    expect(sanitizeAttachmentName("  vorher   nachher.md ")).toBe("vorher nachher.md");
  });

  it("never returns an empty name", () => {
    expect(sanitizeAttachmentName("")).toBe("Datei");
    expect(sanitizeAttachmentName("///")).toBe("Datei");
    expect(sanitizeAttachmentName("\u0000\u0001")).toBe("Datei");
  });

  it("caps the length at the column limit, keeping the end (the extension)", () => {
    const long = `${"x".repeat(400)}.png`;
    const out = sanitizeAttachmentName(long);
    expect(out.length).toBe(255);
    expect(out.endsWith(".png")).toBe(true);
  });
});

describe("base64DecodedLength", () => {
  it.each([
    ["", 0],
    ["QQ==", 1],
    ["QUI=", 2],
    ["QUJD", 3],
    ["QUJDRA==", 4],
  ])("sizes %j without decoding it", (b64, size) => {
    expect(base64DecodedLength(b64)).toBe(size);
    expect(base64DecodedLength(b64)).toBe(Buffer.from(b64, "base64").length);
  });
});

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
  });

  it("uses the decimal separator of the app language", () => {
    expect(formatBytes(1.5 * 1024 * 1024, "de-DE")).toBe("1,5 MB");
  });
});

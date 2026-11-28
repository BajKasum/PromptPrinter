import { describe, expect, it } from "vitest";
import { describeRejection, formatRetryDelay, toWire, viewOf, type Msg } from "@/features/chat/lib/chat-wire";
import type { DraftAttachment } from "@/features/chat/lib/prepare-attachment";
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENTS_REQUEST_BYTES,
} from "@/shared/lib/chat-limits";
import { formatBytes } from "@/shared/lib/chat-attachments";
import { fmt } from "@/shared/i18n/format";
import { de } from "@/shared/i18n/messages/de";

// Was der Chat zwischen Oberfläche und Leitung braucht: welche Daten eine Nachricht mitschickt, was zu einem
// abgelehnten Anhang steht und wie die Wartezeit lautet.

const draft = (overrides: Partial<DraftAttachment> = {}): DraftAttachment => ({
  id: "a1",
  name: "foto.png",
  kind: "image",
  mediaType: "image/png",
  sizeBytes: 1234,
  data: "QUJD",
  previewUrl: "data:image/png;base64,QUJD",
  ...overrides,
});

describe("viewOf", () => {
  it("zeigt die Vorschau eines Fotos über die data:-Adresse, ohne die Bytes als eigenes Feld", () => {
    expect(viewOf(draft())).toEqual({
      id: "a1",
      name: "foto.png",
      kind: "image",
      mediaType: "image/png",
      sizeBytes: 1234,
      url: "data:image/png;base64,QUJD",
    });
  });

  it("hat ohne Vorschau keine Adresse", () => {
    const view = viewOf(draft({ kind: "text", mediaType: "text/plain", previewUrl: undefined }));
    expect(view).not.toHaveProperty("url");
  });
});

describe("toWire", () => {
  const message: Msg = {
    id: "m1",
    role: "user",
    content: "Sieh dir das an",
    attachments: [viewOf(draft())],
    truncated: true,
  };

  it("schickt nur Kennung, Rolle und Text: weder gespeicherte Anhänge noch Anzeigezustand", () => {
    expect(toWire(message)).toEqual({ id: "m1", role: "user", content: "Sieh dir das an" });
    expect(toWire(message, [])).toEqual({ id: "m1", role: "user", content: "Sieh dir das an" });
  });

  it("hängt die Bytes nur an, wenn die Nachricht neu ist, und dann nur Name, Typ und Daten", () => {
    expect(toWire(message, [draft()]).attachments).toEqual([{ name: "foto.png", mediaType: "image/png", data: "QUJD" }]);
  });
});

describe("describeRejection", () => {
  const m = de.chat;
  const bytes = (n: number) => formatBytes(n, "de-DE");

  it.each([
    ["unsupported", { reason: "unsupported", name: "a.exe" }, fmt(m.attachUnsupported, { name: "a.exe" })],
    [
      "tooLarge mit eigener Grenze",
      { reason: "tooLarge", name: "a.txt", maxBytes: 200 * 1024 },
      fmt(m.attachTooLarge, { name: "a.txt", max: bytes(200 * 1024) }),
    ],
    [
      "tooLarge ohne Grenze nennt die Bildgrenze",
      { reason: "tooLarge", name: "a.png" },
      fmt(m.attachTooLarge, { name: "a.png", max: bytes(MAX_ATTACHMENT_IMAGE_BYTES) }),
    ],
    ["notText", { reason: "notText", name: "a.txt" }, fmt(m.attachNotText, { name: "a.txt" })],
    ["unreadable", { reason: "unreadable", name: "a.png" }, fmt(m.attachUnreadable, { name: "a.png" })],
    ["limit", { reason: "limit", name: "a.png" }, fmt(m.attachLimit, { max: MAX_ATTACHMENTS_PER_MESSAGE })],
    [
      "totalTooLarge",
      { reason: "totalTooLarge", name: "a.png" },
      fmt(m.attachTotalTooLarge, { max: bytes(MAX_ATTACHMENTS_REQUEST_BYTES) }),
    ],
  ] as const)("%s", (_name, rejection, text) => {
    const described = describeRejection(rejection, m, "de-DE");
    expect(described).toBe(text);
    expect(described).not.toMatch(/\{\w+\}/);
  });
});

describe("formatRetryDelay", () => {
  const delay = (seconds: number) => formatRetryDelay(seconds, de.chat, "de");

  it.each([
    [0, "1 Sekunde"],
    [0.4, "1 Sekunde"],
    [1, "1 Sekunde"],
    [1.2, "2 Sekunden"],
    [59, "59 Sekunden"],
    [60, "einer Minute"],
    [61, "2 Minuten"],
    [118, "2 Minuten"],
    [3600, "60 Minuten"],
  ])("sagt bei %s Sekunden '%s'", (seconds, text) => {
    expect(delay(seconds)).toBe(text);
  });
});

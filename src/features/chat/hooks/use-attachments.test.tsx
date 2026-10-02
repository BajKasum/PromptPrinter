import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAttachments, type AttachRejection } from "@/features/chat/hooks/use-attachments";
import type { DecodedImage, PrepareDeps } from "@/features/chat/lib/prepare-attachment";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENTS_REQUEST_BYTES,
} from "@/shared/lib/chat-limits";

// Die Bild-Fähigkeiten des Browsers gibt es in jsdom nicht, hier reichen
// Textdateien: sie laufen durch dieselbe Aufbereitung, nur ohne Canvas. Wo ein
// Test steuern will, WANN eine Datei fertig wird, kommt ein Bild mit einem
// Decoder, den der Test selbst auflöst.

const deps: PrepareDeps = {
  decodeImage: vi.fn(),
  toBase64: async (blob) => Buffer.from(await blob.arrayBuffer()).toString("base64"),
};

const text = (name: string, content = "hallo") => new File([content], name, { type: "text/plain" });

function setup() {
  const rejections: AttachRejection[] = [];
  const hook = renderHook(() => useAttachments({ onReject: (r) => rejections.push(r), deps }));
  return { ...hook, rejections };
}

describe("useAttachments", () => {
  it("starts empty", () => {
    const { result } = setup();
    expect(result.current.items).toEqual([]);
    expect(result.current.pending).toBe(0);
  });

  it("adds prepared files in the order they were chosen", async () => {
    const { result } = setup();

    await act(() => result.current.add([text("a.md"), text("b.md"), text("c.md")]));

    expect(result.current.items.map((a) => a.name)).toEqual(["a.md", "b.md", "c.md"]);
    expect(result.current.pending).toBe(0);
  });

  it("holds a slot and counts as pending while a file is still being prepared", async () => {
    let finish!: (d: DecodedImage) => void;
    const slowDeps: PrepareDeps = {
      ...deps,
      decodeImage: () => new Promise<DecodedImage>((resolve) => (finish = resolve)),
    };
    const { result } = renderHook(() => useAttachments({ onReject: () => {}, deps: slowDeps }));

    let done!: Promise<void>;
    act(() => {
      done = result.current.add([new File(["x"], "slow.png", { type: "image/png" })]);
    });
    expect(result.current.pending).toBe(1);

    await act(async () => {
      finish({ width: 10, height: 10, encodeJpeg: async () => null, close: () => {} });
      await done;
    });
    expect(result.current.pending).toBe(0);
    expect(result.current.items).toHaveLength(1);
  });

  it("refuses files beyond the per-message limit, with one message", async () => {
    const { result, rejections } = setup();
    const files = Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE + 2 }, (_, i) => text(`f${i}.md`));

    await act(() => result.current.add(files));

    expect(result.current.items).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
    expect(rejections).toEqual([{ reason: "limit", name: `f${MAX_ATTACHMENTS_PER_MESSAGE}.md` }]);
  });

  it("counts what is already attached against the limit", async () => {
    const { result, rejections } = setup();
    await act(() => result.current.add([text("a.md"), text("b.md"), text("c.md")]));

    await act(() => result.current.add([text("d.md"), text("e.md")]));

    expect(result.current.items.map((a) => a.name)).toEqual(["a.md", "b.md", "c.md", "d.md"]);
    expect(rejections).toEqual([{ reason: "limit", name: "e.md" }]);
  });

  it("does not let two quick picks share the same free slots", async () => {
    const { result } = setup();

    await act(async () => {
      const first = result.current.add([text("1.md"), text("2.md"), text("3.md")]);
      const second = result.current.add([text("4.md"), text("5.md")]);
      await Promise.all([first, second]);
    });

    expect(result.current.items).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
  });

  it("reports a rejected file and still takes the good ones from the same pick", async () => {
    const { result, rejections } = setup();

    await act(() => result.current.add([text("ok.md"), new File(["%PDF"], "report.pdf"), text("also.md")]));

    expect(result.current.items.map((a) => a.name)).toEqual(["ok.md", "also.md"]);
    expect(rejections).toEqual([{ reason: "unsupported", name: "report.pdf", maxBytes: undefined }]);
  });

  it("refuses a file that would push the message over the total size", async () => {
    const { result, rejections } = setup();
    // Zwei Dateien knapp unter der Textgrenze, dazu eine, die nicht mehr passt.
    const nearly = "x".repeat(190 * 1024);
    const needed = Math.ceil(MAX_ATTACHMENTS_REQUEST_BYTES / (190 * 1024));
    const files = Array.from({ length: Math.min(needed + 1, MAX_ATTACHMENTS_PER_MESSAGE) }, (_, i) =>
      text(`big${i}.md`, nearly)
    );

    await act(() => result.current.add(files));

    const total = result.current.items.reduce((sum, a) => sum + a.sizeBytes, 0);
    expect(total).toBeLessThanOrEqual(MAX_ATTACHMENTS_REQUEST_BYTES);
    if (files.length > needed) {
      expect(rejections.some((r) => r.reason === "totalTooLarge")).toBe(true);
    }
  });

  it("removes one attachment by id", async () => {
    const { result } = setup();
    await act(() => result.current.add([text("a.md"), text("b.md")]));
    const [first] = result.current.items;

    act(() => result.current.remove(first.id));

    expect(result.current.items.map((a) => a.name)).toEqual(["b.md"]);
  });

  it("frees the slot again after removing", async () => {
    const { result, rejections } = setup();
    await act(() =>
      result.current.add(Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => text(`f${i}.md`)))
    );
    act(() => result.current.remove(result.current.items[0].id));

    await act(() => result.current.add([text("new.md")]));

    expect(result.current.items).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
    expect(rejections).toEqual([]);
  });

  it("clears everything, and restores a list after a failed send", async () => {
    const { result } = setup();
    await act(() => result.current.add([text("a.md"), text("b.md")]));
    const sent = result.current.items;

    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);

    act(() => result.current.restore(sent));
    expect(result.current.items).toEqual(sent);
  });

  it("does nothing for an empty pick", async () => {
    const { result, rejections } = setup();
    await act(() => result.current.add([]));
    expect(result.current.items).toEqual([]);
    expect(rejections).toEqual([]);
  });
});

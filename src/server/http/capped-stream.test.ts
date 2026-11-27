import { describe, expect, it } from "vitest";
import { readCappedStream } from "./capped-stream";

const tooLarge = () => new Error("zu groß");
const bytes = (text: string) => new TextEncoder().encode(text);

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/** Ein Strom ohne Ende, der mitzählt, wie viel er liefern musste und ob jemand abgebrochen hat. */
function endless(onCancel: () => Promise<void> | void = () => {}) {
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1024;
      controller.enqueue(new Uint8Array(1024).fill(0x61));
    },
    cancel() {
      cancelled = true;
      return onCancel();
    },
  });
  return { stream, pulledBytes: () => pulled, cancelled: () => cancelled };
}

describe("readCappedStream", () => {
  it("liest bis genau an die Grenze", async () => {
    await expect(readCappedStream(streamOf(bytes("ab"), bytes("cd")), 4, tooLarge)).resolves.toBe("abcd");
  });

  it("setzt ein Zeichen zusammen, das über zwei Stücke verteilt ankommt", async () => {
    const umlaut = bytes("ü");
    await expect(readCappedStream(streamOf(umlaut.slice(0, 1), umlaut.slice(1)), 2, tooLarge)).resolves.toBe("ü");
  });

  it("wirft ein Byte über der Grenze, was der Aufrufer baut", async () => {
    const error = new Error("eigener Fehler");
    await expect(readCappedStream(streamOf(bytes("abcde")), 4, () => error)).rejects.toBe(error);
  });

  it("bricht den Strom ab, statt den Rest weiterzuladen, und gibt ihn frei", async () => {
    const body = endless();

    await expect(readCappedStream(body.stream, 4096, tooLarge)).rejects.toThrow("zu groß");

    expect(body.cancelled()).toBe(true);
    expect(body.pulledBytes()).toBeLessThan(10_000);
    expect(body.stream.locked).toBe(false);
  });

  it("wartet nicht auf eine Quelle, die sich mit dem Abbrechen Zeit lässt", async () => {
    const body = endless(() => new Promise<void>(() => {}));
    await expect(readCappedStream(body.stream, 10, tooLarge)).rejects.toThrow("zu groß");
  });

  it("meldet den Fehler der Grenze auch dann, wenn das Abbrechen scheitert", async () => {
    const body = endless(() => Promise.reject(new Error("Abbruch gescheitert")));
    await expect(readCappedStream(body.stream, 10, tooLarge)).rejects.toThrow("zu groß");
  });

  it("reicht einen Lesefehler der Quelle weiter und gibt den Strom frei", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("Verbindung weg"));
      },
    });

    await expect(readCappedStream(stream, 10, tooLarge)).rejects.toThrow("Verbindung weg");
    expect(stream.locked).toBe(false);
  });
});

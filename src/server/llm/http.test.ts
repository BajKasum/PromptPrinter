import { describe, expect, it, vi } from "vitest";
import { readOpenAiCompatibleSse } from "./http";

const frame = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;

function streamOf(chunks: string[], onCancel?: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next === undefined) controller.close();
      else controller.enqueue(encoder.encode(next));
    },
    cancel: () => onCancel?.(),
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const text of readOpenAiCompatibleSse(stream)) out.push(text);
  return out;
}

describe("readOpenAiCompatibleSse", () => {
  it.each([
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["CR", "\r"],
  ])("liest %s-Rahmen gleich", async (_name, eol) => {
    const raw = [frame("Hal"), frame("lo"), "data: [DONE]", ""].join(eol + eol);
    expect(await collect(streamOf([raw]))).toEqual(["Hal", "lo"]);
  });

  it("findet einen Rahmen, dessen Trenner über zwei Stücke verteilt ist", async () => {
    expect(await collect(streamOf([`${frame("a")}\r`, `\n\r`, `\n${frame("b")}\r\n\r\n`]))).toEqual(["a", "b"]);
  });

  it("bricht die Quelle ab, wenn [DONE] vor dem Ende des Bodys kommt", async () => {
    const cancel = vi.fn();
    await collect(streamOf([`${frame("a")}\n\ndata: [DONE]\n\n`, "noch mehr"], cancel));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("bricht die Quelle ab, wenn der Verbraucher vorzeitig aussteigt", async () => {
    const cancel = vi.fn();
    const source = streamOf([`${frame("a")}\n\n`, `${frame("b")}\n\n`], cancel);
    for await (const text of readOpenAiCompatibleSse(source)) {
      expect(text).toBe("a");
      break;
    }
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("bricht die Quelle ab, wenn die Grössengrenze überschritten wird", async () => {
    const cancel = vi.fn();
    const source = streamOf(["x".repeat(20), "y".repeat(20)], cancel);
    await expect(readOpenAiCompatibleSse(source, 10).next()).rejects.toThrow("Limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

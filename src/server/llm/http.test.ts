import { describe, expect, it, vi } from "vitest";
import { readOpenAiCompatibleSse } from "@/server/llm/http";

function readableBody(
  chunks: string[],
  close = true,
  onCancel?: (reason: unknown) => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (close) controller.close();
    },
    cancel(reason) {
      onCancel?.(reason);
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>, maxBytes?: number): Promise<string> {
  let text = "";
  for await (const chunk of readOpenAiCompatibleSse(body, maxBytes)) text += chunk;
  return text;
}

describe("readOpenAiCompatibleSse", () => {
  it("parses CRLF events split across chunks and joins their data fields", async () => {
    const body = readableBody([
      'data: {"choices":[\r',
      '\ndata: {"delta":{"content":"Hallo"}}]}\r',
      "\n\r",
      "\n",
      "data: [DONE]\r\n\r\n",
    ]);

    await expect(collect(body)).resolves.toBe("Hallo");
  });

  it("accepts standalone CR line endings", async () => {
    const event = JSON.stringify({ choices: [{ delta: { content: "Hallo" } }] });

    await expect(collect(readableBody([`data: ${event}\r\r`]))).resolves.toBe("Hallo");
  });

  it("does not cancel the source after natural EOF", async () => {
    const event = JSON.stringify({ choices: [{ delta: { content: "Hallo" } }] });
    const cancel = vi.fn();

    await expect(collect(readableBody([`data: ${event}\n\n`], true, cancel))).resolves.toBe("Hallo");
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels the source when the consumer returns before EOF", async () => {
    const event = JSON.stringify({ choices: [{ delta: { content: "Hallo" } }] });
    const cancel = vi.fn();
    const stream = readOpenAiCompatibleSse(readableBody([`data: ${event}\n\n`], false, cancel));

    await expect(stream.next()).resolves.toEqual({ value: "Hallo", done: false });
    await stream.return(undefined);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels unread source data after the [DONE] event", async () => {
    const event = JSON.stringify({ choices: [{ delta: { content: "Hallo" } }] });
    const cancel = vi.fn();
    const body = readableBody([`data: ${event}\n\n`, "data: [DONE]\n\n"], false, cancel);

    await expect(collect(body)).resolves.toBe("Hallo");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels the source when the byte limit is exceeded", async () => {
    const cancel = vi.fn();
    const body = readableBody(["data: too large\n\n"], false, cancel);

    await expect(collect(body, 1)).rejects.toThrow("überschreitet das Limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

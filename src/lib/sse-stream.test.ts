import { describe, expect, it } from "vitest";
import { parseSseEvents } from "@/lib/sse-stream";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const out: { event: string; data: string }[] = [];
  for await (const e of parseSseEvents(body)) out.push(e);
  return out;
}

describe("parseSseEvents", () => {
  it("parses a single complete frame", async () => {
    const events = await collect(streamFrom(['event: delta\ndata: {"text":"hi"}\n\n']));
    expect(events).toEqual([{ event: "delta", data: '{"text":"hi"}' }]);
  });

  it("parses several frames arriving in one chunk", async () => {
    const events = await collect(
      streamFrom(['event: delta\ndata: {"text":"a"}\n\nevent: done\ndata: {}\n\n'])
    );
    expect(events).toEqual([
      { event: "delta", data: '{"text":"a"}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("reassembles a frame split across multiple network reads", async () => {
    const events = await collect(
      streamFrom(["event: del", 'ta\ndata: {"text":"a', 'b"}\n\n'])
    );
    expect(events).toEqual([{ event: "delta", data: '{"text":"ab"}' }]);
  });

  it("defaults to event 'message' when no event: line is present", async () => {
    const events = await collect(streamFrom(["data: plain\n\n"]));
    expect(events).toEqual([{ event: "message", data: "plain" }]);
  });

  it("ignores a dangling partial frame with no terminating blank line", async () => {
    const events = await collect(streamFrom(["event: delta\ndata: incomplete"]));
    expect(events).toEqual([]);
  });

  it("joins multiple data: lines within one frame with a newline", async () => {
    const events = await collect(streamFrom(["event: delta\ndata: line1\ndata: line2\n\n"]));
    expect(events).toEqual([{ event: "delta", data: "line1\nline2" }]);
  });
});

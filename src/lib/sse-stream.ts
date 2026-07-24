export type SseEvent = { event: string; data: string };

/**
 * Parses /api/chat's hand-rolled `event: X\ndata: Y\n\n` wire protocol (see
 * that route for the event names it actually sends). Not the same dialect as
 * the raw provider SSE parsed server-side in lib/llm.ts's
 * readOpenAiCompatibleSse, that one has no `event:` line, this one is our own
 * framing on top of it. Buffers across chunk boundaries since a network read
 * can split a frame anywhere, including mid-line.
 */
export async function* parseSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = "message";
        const dataLines: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length > 0) yield { event, data: dataLines.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

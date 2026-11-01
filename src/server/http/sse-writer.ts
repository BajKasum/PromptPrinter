import "server-only";

import type { ChatStreamEventName, ChatStreamPayloads } from "@/shared/lib/chat-stream";

// Gegenstück zu sse-stream.ts's parseSseEvents: writes /api/chat's hand-rolled
// `event: X\ndata: Y\n\n` wire protocol server-side instead of parsing it
// client-side. Welche Ereignisse es gibt und welche Nutzlast sie tragen, steht in
// shared/lib/chat-stream.ts; `send` nimmt nur diese Formen.

/**
 * Wraps a ReadableStream controller with `send`/`closeQuietly` helpers. Both
 * swallow errors from writing to an already-closed/errored controller, which
 * happens whenever the client disconnected (it stopped generation, or just
 * navigated away) — nothing is listening on the other end at that point either
 * way.
 */
export function createSseWriter(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();

  function send<E extends ChatStreamEventName>(event: E, data: ChatStreamPayloads[E]) {
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Client already gone.
    }
  }

  function closeQuietly() {
    try {
      controller.close();
    } catch {
      // Already closed.
    }
  }

  return { send, closeQuietly };
}

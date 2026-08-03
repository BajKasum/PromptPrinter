import "server-only";

// Gegenstück zu sse-stream.ts's parseSseEvents: writes /api/chat's hand-rolled
// `event: X\ndata: Y\n\n` wire protocol server-side instead of parsing it
// client-side. Split out of that route (QA finding C-1) purely to shrink the
// file; no behavior change.

/**
 * Wraps a ReadableStream controller with `send`/`closeQuietly` helpers. Both
 * swallow errors from writing to an already-closed/errored controller, which
 * happens whenever the client disconnected (it stopped generation, or just
 * navigated away) — nothing is listening on the other end at that point either
 * way.
 */
export function createSseWriter(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();

  function send(event: string, data: unknown) {
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

import "server-only";

import { MAX_ASSISTANT_MESSAGE_CHARS, MAX_TRANSCRIPT_MESSAGES } from "@/shared/lib/chat-limits";

// Bounded JSON body reading for the API routes (Security-Audit finding H-3).
//
// Next.js App Router route handlers have NO default body size limit — the old
// `api.bodyParser.sizeLimit` was a Pages Router option and does not apply here.
// Every route used to call `await req.json()` as its first statement, which
// buffered and parsed the entire payload before the session check ran. That
// gave an UNAUTHENTICATED caller a cheap memory/CPU primitive: post a huge
// body, have the server parse all of it, and only then receive a 401. The
// rate limiter did not help either, since it also runs after parsing.
//
// Two changes together close it: the routes now authenticate first (see each
// route's own ordering), and the read itself is bounded here.
//
// `content-length` is checked first because it is free, but it is client-
// supplied and therefore not trusted — the streaming read below is the
// authoritative bound, and it is what stops a chunked request that lies about
// (or omits) its length. Same shape as readCappedText in lib/llm.ts, which
// bounds responses from a BYOK endpoint for the same reason.

/** The request body exceeded the route's ceiling. Maps to HTTP 413. */
export class RequestBodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`request body exceeds ${maxBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
}

/** The body was absent or not valid JSON. Maps to HTTP 400. */
export class InvalidJsonBodyError extends Error {
  constructor() {
    super("request body is not valid JSON");
    this.name = "InvalidJsonBodyError";
  }
}

/**
 * Ceiling for /api/chat, derived from the request contract rather than picked:
 * the schema accepts at most MAX_TRANSCRIPT_MESSAGES entries, each at most
 * MAX_ASSISTANT_MESSAGE_CHARS long, and a UTF-8 character is at most 4 bytes.
 * 24 x 40000 x 4 = 3.84 MB, so 4 MB admits every request the schema itself
 * would accept — including a pathological all-astral-plane one — and nothing
 * beyond it. Raising either chat limit has to raise this with it.
 *
 * Realistic traffic sits far below: the client trims to MAX_TRANSCRIPT_MESSAGES
 * before sending (chat.tsx), and a real reply is bounded by the provider's
 * ~6144 output tokens, so a typical full transcript is tens of KB.
 */
export const MAX_CHAT_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Ceiling for the small-JSON routes (/api/projects, /api/settings/api-key).
 * Their schemas top out at a few hundred characters across all fields, so 16 KB
 * is already three orders of magnitude of headroom.
 */
export const MAX_SMALL_BODY_BYTES = 16 * 1024;

/**
 * The largest body chatRequestSchema could still legitimately accept, in bytes.
 * Exported so request-body.test.ts can assert MAX_CHAT_BODY_BYTES stays above
 * it — the invariant belongs in a test rather than a module-level throw, which
 * would turn a limit change into a failure at import time.
 */
export const maxLegitimateChatBodyBytes = () =>
  MAX_TRANSCRIPT_MESSAGES * MAX_ASSISTANT_MESSAGE_CHARS * 4;

/**
 * Reads and JSON-parses a request body, refusing anything past `maxBytes`.
 *
 * Throws RequestBodyTooLargeError or InvalidJsonBodyError; callers map those to
 * 413 and 400 respectively. Never returns a partially-read body.
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!req.body) throw new InvalidJsonBodyError();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      // Checked before buffering the chunk, so the process never holds more
      // than one chunk beyond the ceiling.
      if (total > maxBytes) throw new RequestBodyTooLargeError(maxBytes);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

import { describe, expect, it } from "vitest";
import {
  InvalidJsonBodyError,
  MAX_CHAT_BODY_BYTES,
  MAX_SMALL_BODY_BYTES,
  RequestBodyTooLargeError,
  maxLegitimateChatBodyBytes,
  readJsonBody,
} from "./request-body";

// Security-Audit finding H-3: Next's route handlers have no built-in body size
// limit, so an unauthenticated caller could make the server buffer and parse an
// arbitrarily large payload before the 401. These cover the bound itself; the
// ordering fix (auth before body) is covered by each route's own tests.

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

/** A body whose declared content-length lies about its real size. */
function chunkedRequest(chunks: string[]): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("https://example.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    // @ts-expect-error -- Node's fetch requires this for a stream body; it is
    // not part of the DOM RequestInit type.
    duplex: "half",
  });
}

describe("readJsonBody", () => {
  it("parses a body within the limit", async () => {
    const parsed = await readJsonBody(request(JSON.stringify({ a: 1 })), 1024);
    expect(parsed).toEqual({ a: 1 });
  });

  it("rejects a body past the limit", async () => {
    const big = JSON.stringify({ a: "x".repeat(2048) });
    await expect(readJsonBody(request(big), 1024)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  it("rejects early on an oversized content-length without reading the body", async () => {
    const req = request(JSON.stringify({ a: 1 }), { "content-length": "999999" });
    await expect(readJsonBody(req, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    // The cheap header check short-circuits, so the body is still unread.
    expect(req.bodyUsed).toBe(false);
  });

  // content-length is client-supplied. A chunked request can omit or understate
  // it, so the streaming count — not the header — has to be the real bound.
  it("still rejects when content-length understates the real size", async () => {
    const req = chunkedRequest(['{"a":"', "x".repeat(4096), '"}']);
    await expect(readJsonBody(req, 1024)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects a body that is not valid JSON", async () => {
    await expect(readJsonBody(request("not json"), 1024)).rejects.toBeInstanceOf(
      InvalidJsonBodyError
    );
  });

  it("rejects an empty body", async () => {
    await expect(readJsonBody(request(""), 1024)).rejects.toBeInstanceOf(InvalidJsonBodyError);
  });

  it("accepts a body exactly at the limit", async () => {
    const body = JSON.stringify({ a: "x".repeat(10) });
    const exact = Buffer.byteLength(body, "utf8");
    await expect(readJsonBody(request(body), exact)).resolves.toEqual({ a: "x".repeat(10) });
  });
});

describe("body size ceilings", () => {
  // The chat ceiling is derived from the request contract, not picked: raising
  // MAX_TRANSCRIPT_MESSAGES or MAX_ASSISTANT_MESSAGE_CHARS without raising
  // MAX_CHAT_BODY_BYTES would start 413-ing requests the schema still accepts.
  it("admits every request chatRequestSchema would accept", () => {
    expect(MAX_CHAT_BODY_BYTES).toBeGreaterThanOrEqual(maxLegitimateChatBodyBytes());
  });

  it("keeps the small-JSON ceiling far below the chat one", () => {
    expect(MAX_SMALL_BODY_BYTES).toBeLessThan(MAX_CHAT_BODY_BYTES);
  });
});

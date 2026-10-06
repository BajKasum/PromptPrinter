import "server-only";

import { parseRetryAfter } from "@/server/llm-retry";

// Geteilt von den fetch-Wegen (Z.ai, Custom-Slot, Analyse): Fehler, Zeitlimit, Größengrenze,
// SSE-Leser. (Teil von src/server/llm/, siehe index.ts)

/**
 * Der Fehler für eine nicht erfolgreiche HTTP-Antwort eines fetch-Wegs. Format
 * wie bisher ("<Anbieter> <Status>: <Detail>", classifyLlmFailure liest den
 * Status daraus), dazu die Wartezeit aus dem Retry-After-Header, damit der
 * Retry (llm-retry.ts) einem Anbieter folgt, der selbst sagt, wie lange er
 * braucht. `headers` fehlt in den Test-Attrappen, daher das vorsichtige Lesen.
 */
export function providerHttpError(label: string, res: Response, detail: string): Error {
  const error = new Error(`${label} ${res.status}: ${detail || res.statusText}`);
  const retryAfterMs = parseRetryAfter(res.headers?.get?.("retry-after"));
  if (retryAfterMs !== null) Object.assign(error, { retryAfterMs });
  return error;
}

export type OpenAiCompatibleResponse = {
  choices?: {
    message?: { content?: string; reasoning_content?: string };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

type OpenAiStreamChunk = {
  choices?: { delta?: { content?: string; reasoning_content?: string } }[];
};

/**
 * Shared by zaiCompleteStream and customCompleteStream, both speak the same
 * OpenAI-compatible chat/completions SSE dialect: newline-delimited
 * `data: {...}` frames separated by a blank line, terminated by `data:
 * [DONE]`. Buffers across chunk boundaries since a network read can split a
 * frame anywhere. `maxBytes` bounds total bytes read (see MAX_RESPONSE_BYTES
 * below, defined after this function but only ever read once this one is
 * actually called, well after module init), harmless for zaiCompleteStream
 * (Z.ai's own max_tokens already keeps it far under this in practice), a real
 * bound for customCompleteStream's user-supplied endpoint.
 */
export async function* readOpenAiCompatibleSse(
  body: ReadableStream<Uint8Array>,
  maxBytes: number = MAX_RESPONSE_BYTES
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Antwort überschreitet das Limit von ${maxBytes} Bytes.`);
      }
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;
          let parsed: OpenAiStreamChunk;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = parsed.choices?.[0]?.delta;
          // Same last-resort fallback as the non-streaming reply: content is
          // the real answer, reasoning_content only stands in when a chunk
          // carries nothing else (thinking is off for Z.ai, so this should
          // rarely fire there; a BYOK custom endpoint controls its own
          // thinking flag, so it's kept here too for parity).
          const text = delta?.content || delta?.reasoning_content || "";
          if (text) yield text;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Custom (BYOK only), any OpenAI-compatible chat/completions endpoint ───
// The user supplies their own endpoint + model alongside the key (settings →
// "Eigene API-Keys" → "Custom"), so this covers Z.ai, DeepSeek, Groq,
// OpenRouter, a self-hosted gateway, anything speaking the OpenAI chat/
// completions shape. No "thinking" flag here unlike zaiComplete, that's a
// Z.ai-specific quirk, not something to impose on an arbitrary endpoint.
//
// Unlike Z.ai's own fixed endpoint, `endpoint` here is a user-supplied URL
// that already passed the SSRF check (url-safety.ts) but has none of Z.ai's
// uptime/latency/size guarantees, any signed-in Free user can point it at
// anything reachable, so both requests get two bounds Z.ai doesn't need:
//
// CUSTOM_PROVIDER_TIMEOUT_MS: a hanging endpoint would otherwise tie up the
// request for as long as the platform allows (/api/chat's maxDuration=300s).
// One fixed duration for the whole request (headers + body), not a per-chunk
// idle timeout, simpler, and a genuinely slow-but-steadily-streaming reply
// near the model's own output-token ceiling should still comfortably fit.
//
// MAX_RESPONSE_BYTES: an unbounded read would otherwise let a misbehaving or
// malicious endpoint force an arbitrarily large response straight into
// memory just because the connection itself succeeded. Enforced in
// readCappedText (this file's non-streaming reads) and readOpenAiCompatibleSse
// above (shared with zaiCompleteStream too, harmless there: Z.ai's own
// max_tokens already keeps it far under this ceiling in practice).
const CUSTOM_PROVIDER_TIMEOUT_MS = 60_000;
export const MAX_RESPONSE_BYTES = 2_000_000; // ~2 MB, generous over a real reply's realistic size

/**
 * Merges the caller's own AbortSignal (propagated from /api/chat so a
 * client-side stop still cancels the upstream call, see chatCompleteStream)
 * with the fixed timeout above.
 */
export function withProviderTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(CUSTOM_PROVIDER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Reads a Response's body up to `maxBytes`, throwing instead of buffering past it. */
export async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Antwort überschreitet das Limit von ${maxBytes} Bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

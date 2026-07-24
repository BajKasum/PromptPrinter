import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { assertPublicHttpsUrl } from "@/lib/url-safety";

// The one place that talks to a model provider. Both API routes (/api/chat,
// /api/generate) call chatComplete() and never touch provider SDKs or fetch
// shapes themselves, so switching or adding a provider is a change here only.
//
// Server-side provider priority (first configured key wins), used whenever
// the caller has no BYOK override:
//   1. Z.ai: ZAI_API_KEY (primary; OpenAI-compatible chat/completions)
//   2. Gemini: GEMINI_API_KEY (kept as secondary: the code existed and works)
//   3. none: the routes fall back to their stub responses, so the whole
//      flow stays testable without any key (deliberate, see CLAUDE.md).
//
// BYOK (settings → "Eigene API-Keys"): a signed-in user can store their own
// Anthropic/OpenAI/Gemini key (encrypted, src/lib/crypto.ts) and have their
// calls run against their own account instead of Z.ai, or plug in a generic
// "custom" endpoint (their own label + chat-completions URL + model, Z.ai,
// DeepSeek, Groq, OpenRouter, a self-hosted gateway, anything OpenAI-
// compatible). Z.ai's own server-default key is never a BYOK choice itself,
// it's the platform's own default, not something a user brings a spare key
// for, but a user's own Z.ai key fits perfectly through 'custom'. See
// ByokProvider/LlmOverride below.

export type LlmConfig = { provider: "zai" | "gemini"; model: string };

/** Providers a user can bring their own key for (settings → BYOK). */
export type ByokProvider = "anthropic" | "openai" | "gemini" | "custom";

/**
 * A user's own key, passed per-call to bypass the server's configured
 * provider. 'custom' carries its own endpoint + model since there's no
 * built-in default for an arbitrary OpenAI-compatible provider.
 */
export type LlmOverride =
  | { provider: "anthropic" | "openai" | "gemini"; apiKey: string }
  | { provider: "custom"; apiKey: string; baseUrl: string; model: string };

export type LlmMessage = { role: "user" | "assistant"; content: string };

export type LlmResult = {
  text: string;
  /** Token counts when the provider reports them; null otherwise. */
  usage: { inputTokens: number; outputTokens: number } | null;
};

/**
 * The provider answered, but with nothing usable (blocked, consumed by
 * thinking, …). Distinct from transport/API errors so callers can degrade
 * differently, the generate route falls back to the unfilled template
 * instead of showing a failure note.
 */
export class LlmEmptyReplyError extends Error {
  constructor(provider: string) {
    super(`${provider} returned an empty reply`);
    this.name = "LlmEmptyReplyError";
  }
}

// GLM-4.5-Air, cost-tier default (verified against the live Z.ai account,
// 2026-07): $0.20/$1.10 per M input/output tokens vs. glm-5-turbo's
// $1.20/$4.00, 6x/3.6x cheaper, and a quick quality check against a real
// product prompt came back coherent and well-structured. Every artifact call
// (up to 10 per software-pack run) and every chat turn goes through this, so
// the model choice is the single biggest cost lever in the whole pipeline.
// Overridable via ZAI_MODEL without a code change if quality needs dialing
// back up for a given deployment.
const ZAI_DEFAULT_MODEL = "glm-4.5-air";
const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";

const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

// BYOK defaults, a user's own account, so cost isn't a lever here the way it
// is for ZAI_DEFAULT_MODEL; these just need to be a solid, current model per
// provider. Each is overridable without a code change (mirrors ZAI_MODEL/
// GEMINI_MODEL above), worth revisiting as each provider's lineup moves on.
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";
const OPENAI_DEFAULT_MODEL = "gpt-5.1";

// Thinking is disabled on the Z.ai path (below), so this is a hard ceiling on
// the visible reply, not a budget shared with invisible reasoning tokens.
// 6144 leaves real headroom over the largest artifact observed in practice
// (the database-schema artifact, ~3.5k tokens) while capping the cost/latency
// tail if a model ever rambles, the previous 8192 was ~2.3x oversized against
// that real-world ceiling.
const DEFAULT_MAX_OUTPUT_TOKENS = 6144;

/** Which provider is configured, if any, also the display name for storage. */
export function llmConfig(): LlmConfig | null {
  if (process.env.ZAI_API_KEY) {
    return { provider: "zai", model: process.env.ZAI_MODEL ?? ZAI_DEFAULT_MODEL };
  }
  if (process.env.GEMINI_API_KEY) {
    return { provider: "gemini", model: process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL };
  }
  return null;
}

/**
 * One completion. With `opts.override` (a user's own BYOK key), runs against
 * that provider/account directly, the server's configured provider never
 * enters the picture, so this works even with no server key at all. Without
 * an override, uses the server's configured provider (llmConfig()) and must
 * not be called when that's null. Throws on transport errors, non-2xx
 * responses and empty replies, callers decide how to degrade (the chat
 * route surfaces a 502, the generate route falls back per artifact).
 */
export async function chatComplete(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
}): Promise<LlmResult> {
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  if (opts.override) {
    const { provider, apiKey } = opts.override;
    if (provider === "anthropic") {
      return anthropicComplete(
        ANTHROPIC_DEFAULT_MODEL,
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey
      );
    }
    if (provider === "openai") {
      return openaiComplete(OPENAI_DEFAULT_MODEL, opts.system, opts.messages, maxOutputTokens, apiKey);
    }
    if (provider === "custom") {
      return customComplete(
        opts.override.baseUrl,
        opts.override.model,
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey
      );
    }
    return geminiComplete(GEMINI_DEFAULT_MODEL, opts.system, opts.messages, maxOutputTokens, apiKey);
  }

  const config = llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    return zaiComplete(config.model, opts.system, opts.messages, maxOutputTokens);
  }
  return geminiComplete(
    config.model,
    opts.system,
    opts.messages,
    maxOutputTokens,
    process.env.GEMINI_API_KEY ?? ""
  );
}

/**
 * Same dispatch as chatComplete, but yields text deltas as they arrive
 * instead of waiting for the full reply, /api/chat consumes this to stream
 * the reply to the client turn by turn instead of the client waiting on one
 * opaque round trip. Only used by the chat route: the settings BYOK
 * "test this key" call and anything else that just needs the final text
 * keeps using chatComplete.
 *
 * Doesn't itself throw LlmEmptyReplyError, an empty stream (the generator
 * completing having yielded nothing) is indistinguishable from "the model
 * legitimately said nothing" until the caller has seen the whole thing, so
 * detecting that is left to the caller (checking the accumulated text once
 * the generator completes), same as every provider function below already
 * does for its own non-streaming counterpart.
 *
 * `signal`, when given, is threaded into whichever provider call actually
 * runs (all three SDKs plus plain fetch accept an AbortSignal), so a user
 * stopping generation client-side stops the upstream provider call too, not
 * just the delivery to the browser, /api/chat passes its own Request's
 * signal straight through.
 */
export async function* chatCompleteStream(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  if (opts.override) {
    const { provider, apiKey } = opts.override;
    if (provider === "anthropic") {
      yield* anthropicCompleteStream(
        ANTHROPIC_DEFAULT_MODEL,
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
      return;
    }
    if (provider === "openai") {
      yield* openaiCompleteStream(
        OPENAI_DEFAULT_MODEL,
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
      return;
    }
    if (provider === "custom") {
      yield* customCompleteStream(
        opts.override.baseUrl,
        opts.override.model,
        opts.system,
        opts.messages,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
      return;
    }
    yield* geminiCompleteStream(
      GEMINI_DEFAULT_MODEL,
      opts.system,
      opts.messages,
      maxOutputTokens,
      apiKey,
      opts.signal
    );
    return;
  }

  const config = llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    yield* zaiCompleteStream(config.model, opts.system, opts.messages, maxOutputTokens, opts.signal);
    return;
  }
  yield* geminiCompleteStream(
    config.model,
    opts.system,
    opts.messages,
    maxOutputTokens,
    process.env.GEMINI_API_KEY ?? "",
    opts.signal
  );
}

// ─── Z.ai (OpenAI-compatible chat/completions) ──────────────────────────────

type OpenAiCompatibleResponse = {
  choices?: {
    message?: { content?: string; reasoning_content?: string };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

async function zaiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number
): Promise<LlmResult> {
  const res = await fetch(ZAI_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.ZAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxOutputTokens,
      stream: false,
      // GLM models decide on their own whether to "think"; for prompt-artifact
      // generation that only adds latency and burns output budget, 11 calls
      // run in parallel per software packet. Explicitly off.
      thinking: { type: "disabled" },
    }),
  });

  if (!res.ok) {
    // Error bodies are JSON with error.message; fall back to the raw text,
    // truncated so a proxy HTML page can't flood the surfaced detail.
    const raw = await res.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the truncated raw text
    }
    throw new Error(`Z.ai ${res.status}: ${detail || res.statusText}`);
  }

  const json = (await res.json()) as OpenAiCompatibleResponse;
  const message = json.choices?.[0]?.message;
  // content is the final answer; reasoning_content only ever carries thinking
  // output, so it's a last-resort fallback rather than an equal source.
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? "";
  if (!text) throw new LlmEmptyReplyError("Z.ai");

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage };
}

async function* zaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(ZAI_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${process.env.ZAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxOutputTokens,
      stream: true,
      thinking: { type: "disabled" },
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the truncated raw text
    }
    throw new Error(`Z.ai ${res.status}: ${detail || res.statusText}`);
  }
  if (!res.body) throw new Error("Z.ai hat keinen Antwort-Stream geliefert.");

  yield* readOpenAiCompatibleSse(res.body);
}

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
async function* readOpenAiCompatibleSse(
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
const MAX_RESPONSE_BYTES = 2_000_000; // ~2 MB, generous over a real reply's realistic size

/**
 * Merges the caller's own AbortSignal (propagated from /api/chat so a
 * client-side stop still cancels the upstream call, see chatCompleteStream)
 * with the fixed timeout above.
 */
function withProviderTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(CUSTOM_PROVIDER_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Reads a Response's body up to `maxBytes`, throwing instead of buffering past it. */
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
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

async function customComplete(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  // `endpoint` is the user's own BYOK baseUrl (settings), never a fixed,
  // trusted URL like zaiComplete's, so it's checked against SSRF (private/
  // loopback/link-local targets, cloud metadata) before every request, not
  // only when it's first saved. See url-safety.ts for what this does and
  // doesn't cover (no DNS-rebinding-proof pinning).
  await assertPublicHttpsUrl(endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    // A same-origin redirect would still be user-controlled; a cross-origin
    // one would re-point at an unvalidated URL after the check above already
    // passed. Neither is expected from a real chat/completions endpoint.
    redirect: "error",
    signal: withProviderTimeout(),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxOutputTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
    // Only ever surface a *parsed* error in the provider's expected JSON
    // shape, never the raw body: if `endpoint` ever slipped past the check
    // above (or a legitimate custom provider is compromised), an arbitrary
    // response body must not become a client-visible exfiltration channel.
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Not the expected shape, nothing safe to surface from the body.
    }
    if (!detail) console.error(`[custom-provider] ${res.status} response body:`, raw.slice(0, 500));
    throw new Error(`Custom-Provider ${res.status}: ${detail || res.statusText}`);
  }

  const raw = await readCappedText(res, MAX_RESPONSE_BYTES);
  const json = JSON.parse(raw) as OpenAiCompatibleResponse;
  const message = json.choices?.[0]?.message;
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? "";
  if (!text) throw new LlmEmptyReplyError("Custom-Provider");

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage };
}

async function* customCompleteStream(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  await assertPublicHttpsUrl(endpoint);

  const res = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: withProviderTimeout(signal),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxOutputTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Not the expected shape, nothing safe to surface from the body.
    }
    if (!detail) console.error(`[custom-provider] ${res.status} response body:`, raw.slice(0, 500));
    throw new Error(`Custom-Provider ${res.status}: ${detail || res.statusText}`);
  }
  if (!res.body) throw new Error("Custom-Provider hat keinen Antwort-Stream geliefert.");

  yield* readOpenAiCompatibleSse(res.body);
}

// ─── Gemini (secondary provider, and a BYOK choice) ─────────────────────────

async function geminiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction: system, maxOutputTokens },
  });

  // `text` is undefined when the response was blocked or fully consumed by
  // thinking, treat as empty and let the caller degrade.
  const text = res.text?.trim() ?? "";
  if (!text) throw new LlmEmptyReplyError("Gemini");

  const meta = res.usageMetadata;
  const usage =
    meta && typeof meta.promptTokenCount === "number" && typeof meta.candidatesTokenCount === "number"
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount }
      : null;

  return { text, usage };
}

async function* geminiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey });
  const stream = await ai.models.generateContentStream({
    model,
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

// ─── Anthropic (BYOK only, never the server's own provider) ────────────────

async function anthropicComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const anthropic = new Anthropic({ apiKey });
  const res = await anthropic.messages.create({
    model,
    system,
    max_tokens: maxOutputTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = res.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new LlmEmptyReplyError("Anthropic");

  const usage = res.usage
    ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    : null;

  return { text, usage };
}

async function* anthropicCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const anthropic = new Anthropic({ apiKey });
  const stream = await anthropic.messages.create(
    {
      model,
      system,
      max_tokens: maxOutputTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    },
    { signal }
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

// ─── OpenAI (BYOK only, never the server's own provider) ───────────────────

async function openaiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
    max_completion_tokens: maxOutputTokens,
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new LlmEmptyReplyError("OpenAI");

  const usage = res.usage
    ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
    : null;

  return { text, usage };
}

async function* openaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey });
  const stream = await client.chat.completions.create(
    {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_completion_tokens: maxOutputTokens,
      stream: true,
    },
    { signal }
  );
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

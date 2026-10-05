import "server-only";

import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { assertPublicHttpsUrl } from "@/server/security/url-safety";
import {
  extractStatusCode,
  parseRetryAfter,
  retryStream,
  withRetry,
  type RetryEvent,
} from "@/server/llm-retry";
import {
  callWithFailover,
  failoverEnabled,
  streamWithFailover,
  type ServerProvider,
} from "@/server/llm-failover";
import { captureError } from "@/shared/lib/observability";

// The one place that talks to a model provider. /api/chat (chatCompleteStream,
// the streamed reply itself) and /api/settings/api-key (chatComplete, the
// one-off "test this key" call before it's ever stored) both go through this
// module and never touch provider SDKs or fetch shapes themselves, so
// switching or adding a provider is a change here only.
//
// Server-side provider priority (first configured key wins), used whenever
// the caller has no BYOK override:
//   1. Z.ai: ZAI_API_KEY (primary; OpenAI-compatible chat/completions)
//   2. Gemini: GEMINI_API_KEY (kept as secondary: the code existed and works)
//   3. none: the routes fall back to their stub responses, so the whole
//      flow stays testable without any key (deliberate, see CLAUDE.md).
// With BOTH server keys set, Gemini is also the fallback when Z.ai is DOWN, not
// just the choice when Z.ai is missing: llm-failover.ts decides when (after the
// retries, only for an outage, never for a BYOK call) and keeps the circuit
// breaker. This file only passes the provider through (`serverProvider`).
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

export type LlmMessage = {
  role: "user" | "assistant";
  content: string;
  /**
   * Bilder, die zu dieser Nachricht gehören (Chat-Anhänge). Nur Nutzer-
   * Nachrichten tragen welche. Jeder Anbieter-Pfad unten übersetzt sie in seine
   * eigene Form; ein Z.ai-Zug mit Bildern läuft auf dem sehenden Modell
   * (zaiModelFor), alle anderen Anbieter sind ohnehin multimodal.
   */
  images?: AnalysisImage[];
};

export type LlmResult = {
  text: string;
  /** Token counts when the provider reports them; null otherwise. */
  usage: { inputTokens: number; outputTokens: number } | null;
};

/**
 * The provider answered, but with nothing usable (blocked, consumed by
 * thinking, …). Distinct from transport/API errors so callers can degrade
 * differently: classifyLlmFailure below buckets it as "empty" so /api/chat
 * can show a specific, actionable message instead of a generic failure note.
 */
export class LlmEmptyReplyError extends Error {
  constructor(provider: string) {
    super(`${provider} returned an empty reply`);
    this.name = "LlmEmptyReplyError";
  }
}

/**
 * A small, user-facing bucket for whatever chatComplete/chatCompleteStream
 * threw. QA finding U-4: /api/chat used to embed `err.message` straight into
 * the client-visible detail — raw English provider text carrying the model
 * name and an HTTP status ("Z.ai 429: Rate limit exceeded for model
 * glm-4.5-air"), a broken-language moment plus a small information leak about
 * what's running underneath. The route maps this to a German, non-leaking
 * message; the original error still goes to captureError for the logs.
 */
export type LlmFailure = "rate_limited" | "auth" | "unavailable" | "empty" | "unknown";

export function classifyLlmFailure(err: unknown): LlmFailure {
  if (err instanceof LlmEmptyReplyError) return "empty";
  const status = extractStatusCode(err);
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "auth";
  if (status !== null && status >= 500) return "unavailable";
  if (err instanceof DOMException && err.name === "TimeoutError") return "unavailable";
  if (err instanceof Error && /timeout|timed out/i.test(err.message)) return "unavailable";
  return "unknown";
}

// GLM-4.5-Air, cost-tier default (verified against the live Z.ai account,
// 2026-07): $0.20/$1.10 per M input/output tokens vs. glm-5-turbo's
// $1.20/$4.00, 6x/3.6x cheaper, and a quick quality check against a real
// product prompt came back coherent and well-structured. Every chat turn goes
// through this (the only thing this app generates since the standalone
// generate pipeline was removed, 2026-07-17), so the model choice is the
// single biggest cost lever in the app. Overridable via ZAI_MODEL without a
// code change if quality needs dialing back up for a given deployment.
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
// 6144 tokens is roughly 20-25k characters, comfortably above what a finished,
// paste-ready prompt from a chat turn needs while capping the cost/latency
// tail if a model ever rambles; the previous 8192 was found oversized against
// real replies observed in practice. MAX_ASSISTANT_MESSAGE_CHARS
// (chat-limits.ts) is sized to sit above this ceiling — raise one and check
// the other, see that file's own comment (QA finding F-2).
const DEFAULT_MAX_OUTPUT_TOKENS = 6144;

/**
 * Der Fehler für eine nicht erfolgreiche HTTP-Antwort eines fetch-Wegs. Format
 * wie bisher ("<Anbieter> <Status>: <Detail>", classifyLlmFailure liest den
 * Status daraus), dazu die Wartezeit aus dem Retry-After-Header, damit der
 * Retry (llm-retry.ts) einem Anbieter folgt, der selbst sagt, wie lange er
 * braucht. `headers` fehlt in den Test-Attrappen, daher das vorsichtige Lesen.
 */
function providerHttpError(label: string, res: Response, detail: string): Error {
  const error = new Error(`${label} ${res.status}: ${detail || res.statusText}`);
  const retryAfterMs = parseRetryAfter(res.headers?.get?.("retry-after"));
  if (retryAfterMs !== null) Object.assign(error, { retryAfterMs });
  return error;
}

/**
 * Die Anbieter-SDKs wiederholen von sich aus (Anthropic und OpenAI 2 Mal,
 * Gemini bis zu 5). Das ist hier abgeschaltet: wiederholt wird zentral in
 * llm-retry.ts, mit einer Regel für alle vier Anbieter und mit Rückmeldung an
 * den Browser. Zwei wiederholende Schichten ergäben bis zu 3 x 3 Versuche.
 */
const SDK_NO_RETRY = { maxRetries: 0 } as const;
const GEMINI_NO_RETRY = { httpOptions: { retryOptions: { attempts: 1 } } } as const;

/** Der Anbieter dieses Aufrufs für die Logzeile eines Retries (kein Geheimnis). */
function providerLabel(override: LlmOverride | undefined, serverProvider?: ServerProvider): string {
  return override?.provider ?? serverProvider ?? llmConfig()?.provider ?? "stub";
}

/**
 * Der Server-Anbieter, auf den ein Aufruf GENAU laufen soll (Failover,
 * llm-failover.ts), statt dessen, den llmConfig() von sich aus waehlt. Ohne den
 * Key dieses Anbieters gibt es null: ein Failover auf einen nicht konfigurierten
 * Anbieter faellt nicht still auf den anderen zurueck.
 */
function serverConfigFor(provider: ServerProvider): LlmConfig | null {
  if (provider === "zai" && process.env.ZAI_API_KEY) {
    return { provider: "zai", model: process.env.ZAI_MODEL ?? ZAI_DEFAULT_MODEL };
  }
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    return { provider: "gemini", model: process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL };
  }
  return null;
}

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
 * responses and empty replies. The only caller left is /api/settings/api-key's
 * "test this key" call, which surfaces the error message as-is (deliberately
 * the one place raw provider text stays user-visible, see that route's own
 * comment); /api/chat uses chatCompleteStream below and classifyLlmFailure
 * to turn a failure into a German, non-leaking message instead (QA finding U-4).
 */
export async function chatComplete(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
}): Promise<LlmResult> {
  if (!opts.override && failoverEnabled()) {
    return callWithFailover((serverProvider) =>
      withRetry(() => chatCompleteOnce({ ...opts, serverProvider }), {
        label: providerLabel(undefined, serverProvider),
      })
    );
  }
  return withRetry(() => chatCompleteOnce(opts), { label: providerLabel(opts.override) });
}

async function chatCompleteOnce(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  serverProvider?: ServerProvider;
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

  const config = opts.serverProvider ? serverConfigFor(opts.serverProvider) : llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    return zaiComplete(zaiModelFor(config.model, opts.messages), opts.system, opts.messages, maxOutputTokens);
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
  /**
   * Wird gerufen, wenn ein Versuch an etwas Vorübergehendem gescheitert ist
   * und gleich ein weiterer folgt (siehe llm-retry.ts). Die Chat-Route meldet
   * daraufhin dem Browser, dass es etwas länger dauert.
   */
  onRetry?: (event: RetryEvent) => void;
  /**
   * Wird gerufen, bevor ein Server-Anbieter gefragt wird, wenn ein Failover
   * moeglich ist (llm-failover.ts). Die Route erfaehrt so, auf welchem Anbieter
   * der Zug wirklich lief, fuer das Log. Nie bei einem BYOK-Aufruf.
   */
  onProvider?: (provider: ServerProvider) => void;
}): AsyncGenerator<string> {
  if (!opts.override && failoverEnabled()) {
    yield* streamWithFailover(
      (serverProvider) =>
        retryStream(() => chatCompleteStreamOnce({ ...opts, serverProvider }), {
          signal: opts.signal,
          onRetry: opts.onRetry,
          label: providerLabel(undefined, serverProvider),
        }),
      { signal: opts.signal, onProvider: opts.onProvider }
    );
    return;
  }
  yield* retryStream(() => chatCompleteStreamOnce(opts), {
    signal: opts.signal,
    onRetry: opts.onRetry,
    label: providerLabel(opts.override),
  });
}

async function* chatCompleteStreamOnce(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
  serverProvider?: ServerProvider;
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

  const config = opts.serverProvider ? serverConfigFor(opts.serverProvider) : llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    yield* zaiCompleteStream(
      zaiModelFor(config.model, opts.messages),
      opts.system,
      opts.messages,
      maxOutputTokens,
      opts.signal
    );
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
      messages: toOpenAiMessages(system, messages),
      max_tokens: maxOutputTokens,
      stream: false,
      // GLM models decide on their own whether to "think"; for a chat turn
      // the user is actively waiting on, that only adds latency and burns
      // output budget for no visible benefit. Explicitly off.
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
    throw providerHttpError("Z.ai", res, detail);
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

/**
 * So lange darf Z.ai bis zum ERSTEN Textstueck brauchen (Betriebs-Audit M3).
 *
 * Dieser Weg hatte bisher gar kein Zeitlimit: ein haengender Anbieter, der weder
 * antwortet noch die Verbindung schliesst, blockierte den Zug bis zur maxDuration
 * der Route (300 Sekunden), und weder Retry noch Failover bekamen je einen Fehler
 * zu sehen. glm-4.5-air liefert das erste Textstueck normalerweise in wenigen
 * Sekunden (Denken ist ausgeschaltet); 30 Sekunden sind grosszuegig genug fuer
 * einen langen Projektkontext oder ein Bild und kurz genug, dass ein toter
 * Anbieter nicht die ganze Wartezeit kostet.
 *
 * Nur bis zum ersten Textstueck: danach laeuft ein Stream beliebig lange weiter
 * (eine langsam, aber stetig schreibende Antwort ist kein Ausfall).
 */
export const ZAI_FIRST_CHUNK_TIMEOUT_MS = 30_000;

/**
 * Ein Signal, das zusaetzlich zu dem des Aufrufers nach `ms` mit einem
 * TimeoutError abbricht, solange `stop()` nicht gerufen wurde. Ein TimeoutError
 * ist fuer llm-retry.ts kein "gleich nochmal" (jeder Versuch kostete sonst
 * wieder die ganze Frist), fuer llm-failover.ts aber genau der Fall, in dem ein
 * anderer Anbieter die richtige Antwort ist. Der Abbruch des Nutzers bleibt ein
 * AbortError und loest nichts davon aus.
 */
function firstChunkGuard(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`no first chunk within ${ms} ms`, "TimeoutError"));
  }, ms);
  return {
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    /** Das erste Textstueck ist da (oder der Aufruf ist vorbei): kein Zeitlimit mehr. */
    stop: () => clearTimeout(timer),
  };
}

async function* zaiCompleteStream(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const guard = firstChunkGuard(signal, ZAI_FIRST_CHUNK_TIMEOUT_MS);
  try {
    const res = await fetch(ZAI_ENDPOINT, {
      method: "POST",
      signal: guard.signal,
      headers: {
        authorization: `Bearer ${process.env.ZAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(system, messages),
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
      throw providerHttpError("Z.ai", res, detail);
    }
    if (!res.body) throw new Error("Z.ai hat keinen Antwort-Stream geliefert.");

    for await (const chunk of readOpenAiCompatibleSse(res.body)) {
      guard.stop();
      yield chunk;
    }
  } finally {
    guard.stop();
  }
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
      messages: toOpenAiMessages(system, messages),
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
    if (!detail) {
      captureError("llm.custom_provider_unparsable_error", new Error(`HTTP ${res.status}`), {
        status: res.status,
        bodyChars: raw.length,
      });
    }
    throw providerHttpError("Custom-Provider", res, detail);
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
      messages: toOpenAiMessages(system, messages),
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
    if (!detail) {
      captureError("llm.custom_provider_unparsable_error", new Error(`HTTP ${res.status}`), {
        status: res.status,
        bodyChars: raw.length,
      });
    }
    throw providerHttpError("Custom-Provider", res, detail);
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
  const ai = new GoogleGenAI({ apiKey, ...GEMINI_NO_RETRY });
  const res = await ai.models.generateContent({
    model,
    contents: toGeminiContents(messages),
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
  const ai = new GoogleGenAI({ apiKey, ...GEMINI_NO_RETRY });
  const stream = await ai.models.generateContentStream({
    model,
    contents: toGeminiContents(messages),
    config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

// ─── Anthropic (BYOK only, never the server's own provider) ────────────────

// QA finding P-3: the system instruction (CHAT_SYSTEM_PROMPT + a project
// chat's context block, see route.ts) is already sent first and stays
// identical across every turn of a conversation — only the message history
// after it grows. Marking it as an ephemeral cache breakpoint lets Anthropic
// serve it from cache on every turn after the first instead of billing full
// input price for the same text again, typically ~90% cheaper for the cached
// portion. Silently a no-op below Anthropic's per-model minimum cacheable
// size (1024-2048 tokens depending on model) — a short global chat with no
// project context just doesn't benefit, it doesn't error.
//
// Z.ai/GLM (the server's own default provider, so where this actually
// matters most) already reports a cached_tokens field in its usage response,
// implying automatic prefix caching that needs no request-side flag — the
// same system-prompt-first ordering this file already uses should already
// benefit from it server-side. Not verified against a live account (no key
// available in this environment); Z.ai's own docs don't document the
// streaming-response shape closely enough to build a measurement path with
// real confidence, so that stays a follow-up rather than guessed at here
// (see the finding's own step 3: measure before optimizing further).
function anthropicSystemBlocks(system: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

async function anthropicComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const anthropic = new Anthropic({ apiKey, ...SDK_NO_RETRY });
  const res = await anthropic.messages.create({
    model,
    system: anthropicSystemBlocks(system),
    max_tokens: maxOutputTokens,
    messages: toAnthropicMessages(messages),
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
  const anthropic = new Anthropic({ apiKey, ...SDK_NO_RETRY });
  const stream = await anthropic.messages.create(
    {
      model,
      system: anthropicSystemBlocks(system),
      max_tokens: maxOutputTokens,
      messages: toAnthropicMessages(messages),
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
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const res = await client.chat.completions.create({
    model,
    messages: toOpenAiSdkMessages(system, messages),
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
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const stream = await client.chat.completions.create(
    {
      model,
      messages: toOpenAiSdkMessages(system, messages),
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

// ─── Multimodale Einzelanalyse (Project Brain) ─────────────────────────────
//
// Ein einzelner, nicht gestreamter Aufruf mit einem langen Textblock und
// optional ein paar Bildern. Kein Chat-Verlauf, keine Rollen, genau eine
// Frage — deshalb eine eigene Funktion und keine dritte Variante von
// chatComplete: dessen `messages: LlmMessage[]` sind reiner Text, und sie um
// Bildteile zu erweitern hätte jeden bestehenden Aufrufer mitverbogen.
//
// Der einzige Anbieter, der hier ein anderes Modell braucht, ist Z.ai: das
// Kosten-Standardmodell glm-4.5-air ist textonly. Die drei BYOK-Anbieter
// fahren ihr normales Modell, alle sind ohnehin multimodal.

export type AnalysisImage = { mediaType: string; base64: string };

export type AnalysisResult = LlmResult & {
  /** Welches Modell tatsächlich geantwortet hat, wird am Brain mitgespeichert. */
  model: string;
};

/**
 * Z.ais sehendes Modell.
 *
 * Gegen den echten Account geprüft (2026-08-03): glm-4.6v und glm-4.5v nehmen
 * beide die OpenAI-kompatible image_url-Form mit Data-URI an, glm-4v-flash
 * existiert dort nicht. Überschreibbar ohne Code-Änderung, dieselbe Linie wie
 * ZAI_MODEL.
 */
const ZAI_VISION_DEFAULT_MODEL = "glm-4.6v";

/**
 * Welches Z.ai-Modell antwortet auf diesen Verlauf?
 *
 * Das Kosten-Standardmodell glm-4.5-air sieht keine Bilder. Trägt der Verlauf
 * eines, geht GENAU DIESER Zug an das sehende Modell: teurer, aber nur, wenn
 * jemand ein Bild geschickt hat. Zeigt ein späterer Zug ohne Bild keines mehr
 * (die Anhänge fallen aus dem Modell-Budget, siehe attachment-model.ts), läuft
 * er wieder auf dem günstigen Modell.
 */
export function zaiModelFor(textModel: string, messages: readonly LlmMessage[]): string {
  return messages.some((m) => m.images?.length)
    ? (process.env.ZAI_VISION_MODEL ?? ZAI_VISION_DEFAULT_MODEL)
    : textModel;
}

function imageDataUrl(image: AnalysisImage): string {
  return `data:${image.mediaType};base64,${image.base64}`;
}

/** Verlauf für Z.ai und den Custom-Slot (OpenAI-kompatibles JSON). */
function toOpenAiMessages(system: string, messages: readonly LlmMessage[]) {
  return [
    { role: "system" as const, content: system },
    ...messages.map((m) => ({
      role: m.role,
      // Ohne Bilder die schlichte String-Form, siehe openAiParts.
      content: m.images?.length ? openAiParts(m.content, m.images) : m.content,
    })),
  ];
}

/** Verlauf für das OpenAI-SDK (streng typisiert, Bildteile nur an Nutzer-Nachrichten). */
export function toOpenAiSdkMessages(
  system: string,
  messages: readonly LlmMessage[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: system },
    ...messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
      if (m.role === "user" && m.images?.length) {
        return {
          role: "user",
          content: [
            { type: "text", text: m.content },
            ...m.images.map((image) => ({
              type: "image_url" as const,
              image_url: { url: imageDataUrl(image) },
            })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];
}

/** Verlauf für Gemini: Bilder als inlineData neben dem Text. */
export function toGeminiContents(messages: readonly LlmMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      { text: m.content },
      ...(m.images ?? []).map((image) => ({
        inlineData: { mimeType: image.mediaType, data: image.base64 },
      })),
    ],
  }));
}

/**
 * Verlauf für Anthropic. Bilder stehen VOR dem Text: Anthropics eigene
 * Empfehlung, das Modell liest das Bild dann als Kontext der Frage.
 */
export function toAnthropicMessages(messages: readonly LlmMessage[]): Anthropic.MessageParam[] {
  return messages.map((m): Anthropic.MessageParam => {
    if (m.role === "user" && m.images?.length) {
      return {
        role: "user",
        content: [
          ...m.images.map(
            (image): Anthropic.ImageBlockParam => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType as Anthropic.Base64ImageSource["media_type"],
                data: image.base64,
              },
            })
          ),
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

/** OpenAI-kompatibler Inhaltsblock, von Z.ai und dem Custom-Slot geteilt. */
type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function openAiParts(text: string, images: AnalysisImage[]): OpenAiContentPart[] | string {
  // Ohne Bilder die schlichte String-Form: manche OpenAI-kompatiblen Endpunkte
  // (der Custom-Slot kann alles Mögliche sein) vertragen die Array-Form nur
  // bei echten Vision-Modellen.
  if (images.length === 0) return text;
  return [
    { type: "text", text },
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
    })),
  ];
}

export async function analyzeComplete(opts: {
  system: string;
  text: string;
  images?: AnalysisImage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  if (!opts.override && failoverEnabled()) {
    return callWithFailover(
      (serverProvider) =>
        withRetry(() => analyzeCompleteOnce({ ...opts, serverProvider }), {
          signal: opts.signal,
          label: providerLabel(undefined, serverProvider),
        }),
      { signal: opts.signal }
    );
  }
  return withRetry(() => analyzeCompleteOnce(opts), {
    signal: opts.signal,
    label: providerLabel(opts.override),
  });
}

async function analyzeCompleteOnce(opts: {
  system: string;
  text: string;
  images?: AnalysisImage[];
  maxOutputTokens?: number;
  override?: LlmOverride;
  signal?: AbortSignal;
  serverProvider?: ServerProvider;
}): Promise<AnalysisResult> {
  const maxOutputTokens = opts.maxOutputTokens ?? 1500;
  const images = opts.images ?? [];

  if (opts.override) {
    const { provider, apiKey } = opts.override;
    if (provider === "anthropic") {
      return anthropicAnalyze(
        ANTHROPIC_DEFAULT_MODEL,
        opts.system,
        opts.text,
        images,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
    }
    if (provider === "openai") {
      return openaiAnalyze(
        OPENAI_DEFAULT_MODEL,
        opts.system,
        opts.text,
        images,
        maxOutputTokens,
        apiKey,
        opts.signal
      );
    }
    if (provider === "custom") {
      return openAiCompatibleAnalyze({
        endpoint: opts.override.baseUrl,
        model: opts.override.model,
        label: "Custom-Provider",
        // Der Endpunkt stammt aus Nutzereingabe, also vor JEDEM Request gegen
        // SSRF prüfen — dieselbe Regel wie in customComplete (Kritik-Pass S-1).
        checkUrl: true,
        apiKey,
        system: opts.system,
        text: opts.text,
        images,
        maxOutputTokens,
        signal: opts.signal,
      });
    }
    return geminiAnalyze(
      GEMINI_DEFAULT_MODEL,
      opts.system,
      opts.text,
      images,
      maxOutputTokens,
      apiKey,
      opts.signal
    );
  }

  const config = opts.serverProvider ? serverConfigFor(opts.serverProvider) : llmConfig();
  if (!config) throw new Error("no LLM provider configured");

  if (config.provider === "zai") {
    // Nur wenn wirklich Bilder dabei sind auf das (teurere) sehende Modell
    // wechseln. Eine Analyse aus reinen Textquellen — der Normalfall — läuft
    // weiter auf dem Kosten-Standardmodell.
    const model =
      images.length > 0 ? (process.env.ZAI_VISION_MODEL ?? ZAI_VISION_DEFAULT_MODEL) : config.model;
    return openAiCompatibleAnalyze({
      endpoint: ZAI_ENDPOINT,
      model,
      label: "Z.ai",
      checkUrl: false,
      apiKey: process.env.ZAI_API_KEY ?? "",
      system: opts.system,
      text: opts.text,
      images,
      maxOutputTokens,
      signal: opts.signal,
    });
  }

  return geminiAnalyze(
    config.model,
    opts.system,
    opts.text,
    images,
    maxOutputTokens,
    process.env.GEMINI_API_KEY ?? "",
    opts.signal
  );
}

/** Z.ai und der Custom-Slot sprechen dieselbe API, also auch denselben Code. */
async function openAiCompatibleAnalyze(args: {
  endpoint: string;
  model: string;
  label: string;
  checkUrl: boolean;
  apiKey: string;
  system: string;
  text: string;
  images: AnalysisImage[];
  maxOutputTokens: number;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  if (args.checkUrl) await assertPublicHttpsUrl(args.endpoint);

  const res = await fetch(args.endpoint, {
    method: "POST",
    redirect: "error",
    signal: withProviderTimeout(args.signal),
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: openAiParts(args.text, args.images) },
      ],
      max_tokens: args.maxOutputTokens,
      stream: false,
      // Wie im Chat: GLM entscheidet sonst selbst, ob es "denkt", verbraucht
      // das Ausgabebudget für unsichtbare Zwischenschritte und liefert am
      // Ende ein leeres content-Feld.
      thinking: { type: "disabled" },
    }),
  });

  if (!res.ok) {
    const raw = await readCappedText(res, MAX_RESPONSE_BYTES).catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // Nicht die erwartete Form — aus dem Body nichts weitergeben (S-1).
    }
    throw providerHttpError(args.label, res, detail);
  }

  const json = JSON.parse(await readCappedText(res, MAX_RESPONSE_BYTES)) as OpenAiCompatibleResponse;
  const message = json.choices?.[0]?.message;
  const text = (message?.content?.trim() || message?.reasoning_content?.trim()) ?? "";
  if (!text) throw new LlmEmptyReplyError(args.label);

  const usage =
    json.usage &&
    typeof json.usage.prompt_tokens === "number" &&
    typeof json.usage.completion_tokens === "number"
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : null;

  return { text, usage, model: args.model };
}

async function geminiAnalyze(
  model: string,
  system: string,
  text: string,
  images: AnalysisImage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey, ...GEMINI_NO_RETRY });
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text },
          ...images.map((image) => ({
            inlineData: { mimeType: image.mediaType, data: image.base64 },
          })),
        ],
      },
    ],
    config: { systemInstruction: system, maxOutputTokens, abortSignal: signal },
  });

  const reply = res.text?.trim() ?? "";
  if (!reply) throw new LlmEmptyReplyError("Gemini");

  const meta = res.usageMetadata;
  const usage =
    meta && typeof meta.promptTokenCount === "number" && typeof meta.candidatesTokenCount === "number"
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount }
      : null;

  return { text: reply, usage, model };
}

async function anthropicAnalyze(
  model: string,
  system: string,
  text: string,
  images: AnalysisImage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const anthropic = new Anthropic({ apiKey, ...SDK_NO_RETRY });
  const res = await anthropic.messages.create(
    {
      model,
      system: anthropicSystemBlocks(system),
      max_tokens: maxOutputTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text },
            ...images.map(
              (image): Anthropic.ImageBlockParam => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType as Anthropic.Base64ImageSource["media_type"],
                  data: image.base64,
                },
              })
            ),
          ],
        },
      ],
    },
    { signal }
  );

  const reply = res.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!reply) throw new LlmEmptyReplyError("Anthropic");

  const usage = res.usage
    ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    : null;

  return { text: reply, usage, model };
}

async function openaiAnalyze(
  model: string,
  system: string,
  text: string,
  images: AnalysisImage[],
  maxOutputTokens: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey, ...SDK_NO_RETRY });
  const res = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            images.length === 0
              ? text
              : [
                  { type: "text" as const, text },
                  ...images.map((image) => ({
                    type: "image_url" as const,
                    image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
                  })),
                ],
        },
      ],
      max_completion_tokens: maxOutputTokens,
    },
    { signal }
  );

  const reply = res.choices[0]?.message?.content?.trim() ?? "";
  if (!reply) throw new LlmEmptyReplyError("OpenAI");

  const usage = res.usage
    ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
    : null;

  return { text: reply, usage, model };
}

import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

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

// Z.ai's current plan caps how many requests it'll serve at once, observed:
// firing 5 in parallel gets ~2 through and 429s the rest (error code 1302,
// "Rate limit reached for requests"). /api/generate needs up to 10 artifact
// completions per run, so a plain Promise.all mostly comes back as error
// text. One in flight at a time, with a short retry for the odd 429 that
// slips through anyway, is what actually finishes a run intact; the
// generate route no longer talks to chatComplete directly so this stays the
// one place that decides how a batch of completions gets scheduled.
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 1000;

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && /\b429\b/.test(err.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs one completion per prompt, strictly one at a time, retrying a 429
 * with a short exponential backoff before moving on. Never throws, each
 * entry comes back as either `{ result }` or `{ error }` (the original
 * error, e.g. still `instanceof LlmEmptyReplyError`) so the caller keeps
 * deciding how to degrade per artifact, same as before this existed.
 */
export async function chatCompleteSequential(
  system: string,
  prompts: Record<string, string>,
  opts?: { maxOutputTokens?: number; override?: LlmOverride }
): Promise<Record<string, { result?: LlmResult; error?: unknown }>> {
  const out: Record<string, { result?: LlmResult; error?: unknown }> = {};
  for (const [key, prompt] of Object.entries(prompts)) {
    out[key] = await completeWithRetry(system, prompt, opts?.maxOutputTokens, opts?.override);
  }
  return out;
}

async function completeWithRetry(
  system: string,
  prompt: string,
  maxOutputTokens?: number,
  override?: LlmOverride
): Promise<{ result?: LlmResult; error?: unknown }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    try {
      const result = await chatComplete({
        system,
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens,
        override,
      });
      return { result };
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === RATE_LIMIT_RETRIES) break;
      await sleep(RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  return { error: lastErr };
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

// ─── Custom (BYOK only), any OpenAI-compatible chat/completions endpoint ───
// The user supplies their own endpoint + model alongside the key (settings →
// "Eigene API-Keys" → "Custom"), so this covers Z.ai, DeepSeek, Groq,
// OpenRouter, a self-hosted gateway, anything speaking the OpenAI chat/
// completions shape. No "thinking" flag here unlike zaiComplete, that's a
// Z.ai-specific quirk, not something to impose on an arbitrary endpoint.

async function customComplete(
  endpoint: string,
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number,
  apiKey: string
): Promise<LlmResult> {
  const res = await fetch(endpoint, {
    method: "POST",
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
    const raw = await res.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as OpenAiCompatibleResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the truncated raw text
    }
    throw new Error(`Custom-Provider ${res.status}: ${detail || res.statusText}`);
  }

  const json = (await res.json()) as OpenAiCompatibleResponse;
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

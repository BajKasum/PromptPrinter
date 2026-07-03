import { GoogleGenAI } from "@google/genai";

// The one place that talks to a model provider. Both API routes (/api/chat,
// /api/generate) call chatComplete() and never touch provider SDKs or fetch
// shapes themselves, so switching or adding a provider is a change here only.
//
// Provider priority (first configured key wins):
//   1. Z.ai   — ZAI_API_KEY  (primary; OpenAI-compatible chat/completions)
//   2. Gemini — GEMINI_API_KEY (kept as secondary: the code existed and works,
//      and multi-provider is where the product is headed anyway — BYOK is part
//      of the Free-plan positioning. Costs ~25 lines, changes nothing else.)
//   3. none   — the routes fall back to their stub responses, so the whole
//      flow stays testable without any key (deliberate, see CLAUDE.md).

export type LlmConfig = { provider: "zai" | "gemini"; model: string };

export type LlmMessage = { role: "user" | "assistant"; content: string };

export type LlmResult = {
  text: string;
  /** Token counts when the provider reports them; null otherwise. */
  usage: { inputTokens: number; outputTokens: number } | null;
};

/**
 * The provider answered, but with nothing usable (blocked, consumed by
 * thinking, …). Distinct from transport/API errors so callers can degrade
 * differently — the generate route falls back to the unfilled template
 * instead of showing a failure note.
 */
export class LlmEmptyReplyError extends Error {
  constructor(provider: string) {
    super(`${provider} returned an empty reply`);
    this.name = "LlmEmptyReplyError";
  }
}

// GLM-5-Turbo — the fast tier of Z.ai's current flagship series: same
// "near-flagship quality at speed/price" philosophy the previous Gemini
// Flash default followed. Overridable via ZAI_MODEL without a code change.
const ZAI_DEFAULT_MODEL = "glm-5-turbo";
const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4/chat/completions";

const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

// 8k output leaves room for a full-length artifact; thinking is disabled on
// the Z.ai path (below), so nothing eats into this budget invisibly.
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/** Which provider is configured, if any — also the display name for storage. */
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
 * One completion against the configured provider. Throws on transport errors,
 * non-2xx responses and empty replies — callers decide how to degrade (the
 * chat route surfaces a 502, the generate route falls back per artifact).
 * Must not be called when llmConfig() is null.
 */
export async function chatComplete(opts: {
  system: string;
  messages: LlmMessage[];
  maxOutputTokens?: number;
}): Promise<LlmResult> {
  const config = llmConfig();
  if (!config) throw new Error("no LLM provider configured");
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  if (config.provider === "zai") {
    return zaiComplete(config.model, opts.system, opts.messages, maxOutputTokens);
  }
  return geminiComplete(config.model, opts.system, opts.messages, maxOutputTokens);
}

// ─── Z.ai (OpenAI-compatible chat/completions) ──────────────────────────────

type ZaiResponse = {
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
      // generation that only adds latency and burns output budget — 11 calls
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
      const parsed = JSON.parse(raw) as ZaiResponse;
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep the truncated raw text
    }
    throw new Error(`Z.ai ${res.status}: ${detail || res.statusText}`);
  }

  const json = (await res.json()) as ZaiResponse;
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

// ─── Gemini (secondary provider) ─────────────────────────────────────────────

async function geminiComplete(
  model: string,
  system: string,
  messages: LlmMessage[],
  maxOutputTokens: number
): Promise<LlmResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model,
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction: system, maxOutputTokens },
  });

  // `text` is undefined when the response was blocked or fully consumed by
  // thinking — treat as empty and let the caller degrade.
  const text = res.text?.trim() ?? "";
  if (!text) throw new LlmEmptyReplyError("Gemini");

  const meta = res.usageMetadata;
  const usage =
    meta && typeof meta.promptTokenCount === "number" && typeof meta.candidatesTokenCount === "number"
      ? { inputTokens: meta.promptTokenCount, outputTokens: meta.candidatesTokenCount }
      : null;

  return { text, usage };
}

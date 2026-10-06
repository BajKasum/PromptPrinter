import "server-only";

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
// Anthropic/OpenAI/Gemini key (encrypted, src/server/security/crypto.ts) and have their
// calls run against their own account instead of Z.ai, or plug in a generic
// "custom" endpoint (their own label + chat-completions URL + model, Z.ai,
// DeepSeek, Groq, OpenRouter, a self-hosted gateway, anything OpenAI-
// compatible). Z.ai's own server-default key is never a BYOK choice itself,
// it's the platform's own default, not something a user brings a spare key
// for, but a user's own Z.ai key fits perfectly through 'custom'. See
// ByokProvider/LlmOverride below.
//
// ─── Aufbau (Betriebs-Audit M7, Teil 2) ─────────────────────────────────────
// Diese Datei ist nur noch die öffentliche Fläche: "@/server/llm" bleibt der einzige
// Import, den Routen und Tests kennen. Der Code liegt je Anbieter in einer Datei.
//
//   types.ts      Typen, LlmEmptyReplyError, classifyLlmFailure
//   config.ts     Auswahl des Server-Anbieters (llmConfig, serverConfigFor), Standardmodelle,
//                 Token-Grenze, abgeschaltete SDK-Wiederholungen
//   chat.ts       chatComplete / chatCompleteStream: wählt den Anbieter, hängt Retry und Failover an
//   analyze.ts    analyzeComplete: die Einzelanalyse des Projekt-Gedächtnisses
//   zai.ts        Z.ai (fetch, Stream mit Zeitlimit bis zum ersten Textstück)
//   custom.ts     Custom-Slot (fetch, SSRF-Prüfung, Größen- und Zeitgrenze)
//   gemini.ts     Gemini (SDK)
//   anthropic.ts  Anthropic (SDK, BYOK)
//   openai.ts     OpenAI (SDK, BYOK)
//   messages.ts   Verlauf und Bilder in der Form jedes Anbieters
//   http.ts       Geteiltes der fetch-Wege: Fehler, Zeitlimit, Größengrenze, SSE-Leser
//
// llm-retry.ts und llm-failover.ts liegen daneben (src/server/): jeder Aufruf geht durch sie.

export { analyzeComplete } from "@/server/llm/analyze";
export { chatComplete, chatCompleteStream } from "@/server/llm/chat";
export { llmConfig, zaiModelFor } from "@/server/llm/config";
export { toAnthropicMessages, toGeminiContents, toOpenAiSdkMessages } from "@/server/llm/messages";
export { LlmEmptyReplyError, classifyLlmFailure } from "@/server/llm/types";
export type {
  AnalysisImage,
  AnalysisResult,
  ByokProvider,
  LlmConfig,
  LlmFailure,
  LlmMessage,
  LlmOverride,
  LlmResult,
} from "@/server/llm/types";
export { ZAI_FIRST_CHUNK_TIMEOUT_MS } from "@/server/llm/zai";
